// src/modules/goals/__tests__/vinculo.routes.test.ts
// Vincular uma transação a uma meta, pela API de transações (feature pedida na revisão do Grupo 5): ao cadastrar (POST) ou
// editar em lote (PATCH /bulk), a transação passa a contar como aporte no progresso da meta. Só vale para metas do PRÓPRIO
// usuário. O Servidor Java é simulado (apoio.ts).
import { ANA, BETO, ID_INEXISTENTE, diasAFrente, inicioDoDiaUtc, inserir, json, prepararApi, simularServidorGrupo5 } from "./apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { GoalModel } from "../goals.model";
import { TransactionModel } from "../../transactions/transactions.model";

const { chamar } = prepararApi();

const api = (metodo: string, caminho: string, corpo?: unknown, token: string | null = ANA) =>
  chamar(metodo, caminho, token ?? undefined, corpo);

const criarMeta = async (titulo = "Viagem", token: string | null = ANA) =>
  json(await api("POST", "/goals", { titulo, valorObjetivo: 10000, prazo: diasAFrente(181).toISOString() }, token));

const TRANSACAO = { tipo: "despesa", valor: 500, categoria: "Outros", data: "2026-11-14", descricao: "Separei para a viagem", formaPagamento: "pix" };
const registrar = async (corpo: Record<string, unknown>, token: string | null = ANA) => json(await api("POST", "/transactions", corpo, token));
const meta = async (id: string, token: string | null = ANA) => json(await api("GET", `/goals/${id}`, undefined, token));
const noBanco = (id: string) => TransactionModel.findById(id).lean();

describe("POST /v1/transactions com metaId", () => {
  test("vincula a transação à meta (201 com o metaId) e ela vira aporte no progresso", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const resposta = await api("POST", "/transactions", { ...TRANSACAO, metaId: m.id });
    const criada = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.equal(criada.metaId, m.id);
    const depois = await meta(m.id);
    assert.equal(depois.valorAportado, 500);
    assert.equal(depois.quantidadeAportes, 1);
    assert.equal(depois.percentual, 5);
  });

  test("receita vinculada é uma retirada: subtrai do que foi guardado", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    await registrar({ ...TRANSACAO, tipo: "despesa", valor: 500, metaId: m.id });
    await registrar({ ...TRANSACAO, tipo: "receita", valor: 300, metaId: m.id });
    const depois = await meta(m.id);
    assert.equal(depois.valorAportado, 200);
    assert.equal(depois.quantidadeAportes, 2, "as duas continuam vinculadas");
  });

  test("sem metaId: a resposta não traz o campo e a transação não conta em meta nenhuma", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const criada = await registrar(TRANSACAO);
    assert.ok(!("metaId" in criada));
    assert.equal((await meta(m.id)).valorAportado, 0);
  });

  test("vários aportes na mesma meta somam, e cada meta tem o seu total", async () => {
    simularServidorGrupo5();
    const a = await criarMeta("A");
    const b = await criarMeta("B");
    await registrar({ ...TRANSACAO, valor: 100, metaId: a.id });
    await registrar({ ...TRANSACAO, valor: 200, metaId: a.id });
    await registrar({ ...TRANSACAO, valor: 40, metaId: b.id });

    assert.equal((await meta(a.id)).valorAportado, 300);
    assert.equal((await meta(a.id)).quantidadeAportes, 2);
    assert.equal((await meta(b.id)).valorAportado, 40);
  });

  test("a listagem de transações devolve o metaId das vinculadas", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    await registrar({ ...TRANSACAO, descricao: "vinculada", metaId: m.id });
    await registrar({ ...TRANSACAO, descricao: "solta" });
    const { itens } = await json(await api("GET", "/transactions"));
    assert.equal(itens.find((t: any) => t.descricao === "vinculada").metaId, m.id);
    assert.ok(!("metaId" in itens.find((t: any) => t.descricao === "solta")));
  });

  test("meta de outro usuário: 404 GOAL_NOT_FOUND e a transação NÃO é salva", async () => {
    simularServidorGrupo5();
    const doBeto = await criarMeta("do Beto", BETO);
    const resposta = await api("POST", "/transactions", { ...TRANSACAO, metaId: doBeto.id });
    assert.equal(resposta.status, 404);
    assert.equal((await json(resposta)).error.code, "GOAL_NOT_FOUND");
    assert.equal(await TransactionModel.countDocuments(), 0);
    assert.equal((await meta(doBeto.id, BETO)).valorAportado, 0);
  });

  test("meta inexistente: 404 GOAL_NOT_FOUND e nada é salvo", async () => {
    simularServidorGrupo5();
    const resposta = await api("POST", "/transactions", { ...TRANSACAO, metaId: ID_INEXISTENTE });
    assert.equal(resposta.status, 404);
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("metaId mal formado: 400 VALIDATION_ERROR apontando o campo", async () => {
    simularServidorGrupo5();
    for (const metaId of ["abc", 123, ""]) {
      const resposta = await api("POST", "/transactions", { ...TRANSACAO, metaId });
      const erro = (await json(resposta)).error;
      assert.equal(resposta.status, 400, String(metaId));
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.metaId));
    }
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("vincular não depende do Servidor de categorização: com a categoria informada, nada é pedido a ele", async () => {
    const pedidos = simularServidorGrupo5();
    const m = await criarMeta();
    pedidos.length = 0;
    await registrar({ ...TRANSACAO, metaId: m.id });
    assert.equal(pedidos.filter((p) => p.tipo !== "PedidoProgressoMeta").length, 0);
  });
});

describe("POST /v1/transactions/:id/duplicate", () => {
  test("a cópia fica vinculada à mesma meta (um aporte parecido) e soma de novo", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const original = await registrar({ ...TRANSACAO, metaId: m.id });
    const copia = await json(await api("POST", `/transactions/${original.id}/duplicate`));

    assert.equal(copia.metaId, m.id);
    assert.equal((await meta(m.id)).valorAportado, 1000);
    assert.equal((await meta(m.id)).quantidadeAportes, 2);
  });
});

describe("PATCH /v1/transactions/bulk com metaId", () => {
  test("vincula transações que já existiam (inclusive importadas) e desvincula com null", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const manual = await inserir("ana", { valor: 200, data: inicioDoDiaUtc() });
    const importada = await inserir("ana", { valor: 800, data: inicioDoDiaUtc(), origem: "pluggy", externalId: "ext-1" });

    const vincular = await api("PATCH", "/transactions/bulk", { itens: [
      { id: manual, alteracoes: { metaId: m.id } },
      { id: importada, alteracoes: { metaId: m.id } },
    ] });
    assert.deepEqual(await json(vincular), { afetadas: 2, naoEncontradas: [] });
    assert.equal((await meta(m.id)).valorAportado, 1000);

    const desvincular = await api("PATCH", "/transactions/bulk", { itens: [{ id: manual, alteracoes: { metaId: null } }] });
    assert.equal(desvincular.status, 200);
    assert.ok(!("metaId" in (await noBanco(manual))!), "o campo some do banco");
    assert.equal((await noBanco(importada))?.metaId, m.id, "a outra continua vinculada");
    assert.equal((await meta(m.id)).valorAportado, 800);
  });

  test("trocar de meta move o aporte de uma para a outra", async () => {
    simularServidorGrupo5();
    const a = await criarMeta("A");
    const b = await criarMeta("B");
    const t = await registrar({ ...TRANSACAO, valor: 300, metaId: a.id });
    await api("PATCH", "/transactions/bulk", { itens: [{ id: t.id, alteracoes: { metaId: b.id } }] });

    assert.equal((await meta(a.id)).valorAportado, 0);
    assert.equal((await meta(b.id)).valorAportado, 300);
  });

  test("dá para vincular e mudar outros campos no mesmo item", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const t = await inserir("ana", { valor: 10, descricao: "antes", data: inicioDoDiaUtc() });
    await api("PATCH", "/transactions/bulk", { itens: [{ id: t, alteracoes: { metaId: m.id, descricao: "depois", valor: 250 } }] });
    const depois = await noBanco(t);
    assert.equal(depois?.descricao, "depois");
    assert.equal(depois?.metaId, m.id);
    assert.equal((await meta(m.id)).valorAportado, 250);
  });

  test("meta de outro usuário recusa o lote INTEIRO (404) e nada muda, nem os itens anteriores", async () => {
    simularServidorGrupo5();
    const minha = await criarMeta();
    const doBeto = await criarMeta("do Beto", BETO);
    const t1 = await inserir("ana", { valor: 10, data: inicioDoDiaUtc() });
    const t2 = await inserir("ana", { valor: 20, data: inicioDoDiaUtc() });

    const resposta = await api("PATCH", "/transactions/bulk", { itens: [
      { id: t1, alteracoes: { metaId: minha.id } },
      { id: t2, alteracoes: { metaId: doBeto.id } },
    ] });
    assert.equal(resposta.status, 404);
    assert.equal((await json(resposta)).error.code, "GOAL_NOT_FOUND");
    assert.ok(!("metaId" in (await noBanco(t1))!), "o primeiro item, que era válido, também não mudou");
    assert.ok(!("metaId" in (await noBanco(t2))!));
  });

  test("metaId mal formado: 400 e nada muda", async () => {
    simularServidorGrupo5();
    const t = await inserir("ana", { valor: 10, data: inicioDoDiaUtc() });
    for (const metaId of ["abc", 5, ""]) {
      const resposta = await api("PATCH", "/transactions/bulk", { itens: [{ id: t, alteracoes: { metaId } }] });
      assert.equal(resposta.status, 400, String(metaId));
    }
    assert.ok(!("metaId" in (await noBanco(t))!));
  });

  test("transação de outro usuário continua 'não encontrada', mesmo com uma meta válida", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const doBeto = await inserir("beto", { valor: 10, data: inicioDoDiaUtc() });
    const resposta = await api("PATCH", "/transactions/bulk", { itens: [{ id: doBeto, alteracoes: { metaId: m.id } }] });
    assert.deepEqual(await json(resposta), { afetadas: 0, naoEncontradas: [doBeto] });
    assert.ok(!("metaId" in (await noBanco(doBeto))!));
  });
});

describe("excluir a meta ou a transação", () => {
  test("excluir a meta desvincula as transações: elas ficam no extrato, sem metaId", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const t = await registrar({ ...TRANSACAO, metaId: m.id });
    await api("DELETE", `/goals/${m.id}`);

    const { itens } = await json(await api("GET", "/transactions"));
    assert.equal(itens.length, 1);
    assert.ok(!("metaId" in itens[0]));
    assert.ok(!("metaId" in (await noBanco(t.id))!));
  });

  test("excluir a transação tira o aporte do progresso", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    const t = await registrar({ ...TRANSACAO, metaId: m.id });
    assert.equal((await meta(m.id)).valorAportado, 500);

    await api("POST", "/transactions/bulk-delete", { ids: [t.id] });
    assert.equal((await meta(m.id)).valorAportado, 0);
  });

  test("a meta continua existindo para quem a criou (nada é apagado por vincular)", async () => {
    simularServidorGrupo5();
    const m = await criarMeta();
    await registrar({ ...TRANSACAO, metaId: m.id });
    assert.equal(await GoalModel.countDocuments(), 1);
  });
});
