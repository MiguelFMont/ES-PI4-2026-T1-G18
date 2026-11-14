// src/modules/transactions/__tests__/lote.routes.test.ts
// PATCH /v1/transactions/bulk e POST /v1/transactions/bulk-delete de ponta a ponta no Backend (issue #59): edição e
// exclusão só existem em lote (um item só também vale). O lote não é tudo ou nada: faz o que existe e devolve os ids
// que não foram encontrados (inexistentes ou de outro usuário).
import { ANA, BETO, ID_INEXISTENTE, inserir, json, prepararApi, textoDe } from "./apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TransactionModel } from "../transactions.model";

const { chamar, chamarComTexto } = prepararApi();

const editar = (itens: unknown, token: string | null = ANA) =>
  chamar("PATCH", "/transactions/bulk", token ?? undefined, itens === undefined ? undefined : { itens });
const excluir = (ids: unknown, token: string | null = ANA) =>
  chamar("POST", "/transactions/bulk-delete", token ?? undefined, ids === undefined ? undefined : { ids });

const doBanco = (id: string) => TransactionModel.findById(id).lean();
const total = () => TransactionModel.countDocuments();

describe("PATCH /v1/transactions/bulk: edição em lote", () => {
  test("altera os campos informados e devolve { afetadas, naoEncontradas }", async () => {
    const id = await inserir("ana");
    const resposta = await editar([{
      id,
      alteracoes: { tipo: "receita", valor: 99.5, categoria: "Salario", data: "2026-12-01", descricao: "  Novo nome  ", observacoes: "nota", formaPagamento: "pix" },
    }]);

    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { afetadas: 1, naoEncontradas: [] });
    const depois = await doBanco(id);
    assert.equal(depois?.tipo, "receita");
    assert.equal(depois?.valor, 99.5);
    assert.equal(depois?.categoria, "Salario");
    assert.equal(depois?.data.toISOString(), "2026-12-01T00:00:00.000Z");
    assert.equal(depois?.descricao, "Novo nome", "espaços nas pontas são removidos");
    assert.equal(depois?.observacoes, "nota");
    assert.equal(depois?.formaPagamento, "pix");
  });

  test("alteração parcial: só muda o que veio, o resto fica como estava", async () => {
    const id = await inserir("ana", { observacoes: "antiga" });
    const antes = await doBanco(id);
    await editar([{ id, alteracoes: { valor: 7 } }]);
    const depois = await doBanco(id);

    assert.equal(depois?.valor, 7);
    for (const campo of ["tipo", "categoria", "descricao", "observacoes", "formaPagamento", "origem", "userId"] as const) {
      assert.equal(depois?.[campo], antes?.[campo], campo);
    }
    assert.equal(depois?.data.toISOString(), antes?.data.toISOString());
  });

  test("cada transação do lote recebe as próprias alterações", async () => {
    const a = await inserir("ana", { descricao: "A", valor: 10 });
    const b = await inserir("ana", { descricao: "B", valor: 20 });
    const resposta = await editar([
      { id: a, alteracoes: { valor: 11 } },
      { id: b, alteracoes: { descricao: "B2", categoria: "Lazer" } },
    ]);

    assert.deepEqual(await json(resposta), { afetadas: 2, naoEncontradas: [] });
    assert.equal((await doBanco(a))?.valor, 11);
    assert.equal((await doBanco(a))?.descricao, "A");
    assert.equal((await doBanco(b))?.valor, 20);
    assert.equal((await doBanco(b))?.descricao, "B2");
    assert.equal((await doBanco(b))?.categoria, "Lazer");
  });

  test("observação em branco ('') apaga o campo do banco", async () => {
    const id = await inserir("ana", { observacoes: "para apagar" });
    await editar([{ id, alteracoes: { observacoes: "" } }]);
    const depois = await doBanco(id);
    assert.ok(!("observacoes" in depois!), "o campo deve sumir, não ficar vazio");
    const { itens } = await json(await chamar("GET", "/transactions", ANA));
    assert.ok(!("observacoes" in itens[0]));
  });

  test("não é tudo ou nada: o que existe é alterado e o que não existe volta em naoEncontradas", async () => {
    const existe = await inserir("ana", { valor: 10 });
    const resposta = await editar([
      { id: existe, alteracoes: { valor: 55 } },
      { id: ID_INEXISTENTE, alteracoes: { valor: 66 } },
    ]);

    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { afetadas: 1, naoEncontradas: [ID_INEXISTENTE] });
    assert.equal((await doBanco(existe))?.valor, 55);
    assert.equal(await total(), 1, "nada é criado para o id que não existia");
  });

  test("lote só com ids inexistentes: afetadas 0", async () => {
    const resposta = await editar([{ id: ID_INEXISTENTE, alteracoes: { valor: 1 } }]);
    assert.deepEqual(await json(resposta), { afetadas: 0, naoEncontradas: [ID_INEXISTENTE] });
  });

  test("transação de outro usuário não é alterada e conta como não encontrada", async () => {
    const doBeto = await inserir("beto", { valor: 10, descricao: "do Beto" });
    const resposta = await editar([{ id: doBeto, alteracoes: { valor: 9999, descricao: "invadida" } }], ANA);

    assert.deepEqual(await json(resposta), { afetadas: 0, naoEncontradas: [doBeto] });
    const intacta = await doBanco(doBeto);
    assert.equal(intacta?.valor, 10);
    assert.equal(intacta?.descricao, "do Beto");
  });

  test("a origem e o dono não mudam por aqui, mesmo se vierem no corpo", async () => {
    const id = await inserir("ana", { valor: 10 });
    const resposta = await editar([{ id, alteracoes: { valor: 20, origem: "pluggy", userId: "beto" } }]);

    assert.equal(resposta.status, 200);
    const depois = await doBanco(id);
    assert.equal(depois?.valor, 20);
    assert.equal(depois?.origem, "manual");
    assert.equal(depois?.userId, "ana");
  });

  test("lote com 100 itens (o máximo) é aceito", async () => {
    const itens = Array.from({ length: 100 }, (_, i) => ({ id: (i.toString(16).padStart(24, "0")), alteracoes: { valor: 1 } }));
    const resposta = await editar(itens);
    assert.equal(resposta.status, 200);
    assert.equal((await json(resposta)).naoEncontradas.length, 100);
  });

  test("sem token: 401 UNAUTHENTICATED e nada muda", async () => {
    const id = await inserir("ana", { valor: 10 });
    const resposta = await editar([{ id, alteracoes: { valor: 55 } }], null);
    assert.equal(resposta.status, 401);
    assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    assert.equal((await doBanco(id))?.valor, 10);
  });
});

describe("PATCH /v1/transactions/bulk: validação (400 VALIDATION_ERROR, e nada é alterado)", () => {
  const casos: { nome: string; montar: (id: string) => unknown }[] = [
    { nome: "sem o corpo", montar: () => undefined },
    { nome: "lista vazia", montar: () => [] },
    { nome: "mais de 100 itens", montar: () => Array.from({ length: 101 }, (_, i) => ({ id: i.toString(16).padStart(24, "0"), alteracoes: { valor: 1 } })) },
    { nome: "ids repetidos", montar: (id) => [{ id, alteracoes: { valor: 1 } }, { id, alteracoes: { valor: 2 } }] },
    { nome: "id mal formado", montar: () => [{ id: "abc", alteracoes: { valor: 1 } }] },
    { nome: "alterações vazias", montar: (id) => [{ id, alteracoes: {} }] },
    { nome: "alterações só com campos que não existem", montar: (id) => [{ id, alteracoes: { origem: "pluggy" } }] },
    { nome: "valor zero", montar: (id) => [{ id, alteracoes: { valor: 0 } }] },
    { nome: "valor negativo", montar: (id) => [{ id, alteracoes: { valor: -3 } }] },
    { nome: "valor como texto", montar: (id) => [{ id, alteracoes: { valor: "10" } }] },
    { nome: "tipo desconhecido", montar: (id) => [{ id, alteracoes: { tipo: "transferencia" } }] },
    { nome: "categoria vazia", montar: (id) => [{ id, alteracoes: { categoria: "" } }] },
    { nome: "descrição só com espaços", montar: (id) => [{ id, alteracoes: { descricao: "   " } }] },
    { nome: "data inválida", montar: (id) => [{ id, alteracoes: { data: "ontem" } }] },
    { nome: "observação com 301 caracteres", montar: (id) => [{ id, alteracoes: { observacoes: textoDe(301) } }] },
    { nome: "forma de pagamento desconhecida", montar: (id) => [{ id, alteracoes: { formaPagamento: "cheque" } }] },
  ];

  for (const { nome, montar } of casos) {
    test(nome, async () => {
      const id = await inserir("ana", { valor: 10, descricao: "original" });
      const resposta = await editar(montar(id));

      assert.equal(resposta.status, 400);
      assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
      const intacta = await doBanco(id);
      assert.equal(intacta?.valor, 10);
      assert.equal(intacta?.descricao, "original");
    });
  }

  test("um item inválido no meio recusa o lote inteiro: nenhum item é alterado", async () => {
    const a = await inserir("ana", { valor: 10 });
    const b = await inserir("ana", { valor: 20 });
    const resposta = await editar([
      { id: a, alteracoes: { valor: 111 } },
      { id: b, alteracoes: { valor: -1 } },
    ]);
    assert.equal(resposta.status, 400);
    assert.equal((await doBanco(a))?.valor, 10, "o primeiro, que era válido, também não pode ter mudado");
    assert.equal((await doBanco(b))?.valor, 20);
  });

  test("corpo que não é JSON: 400 VALIDATION_ERROR", async () => {
    const resposta = await chamarComTexto("PATCH", "/transactions/bulk", ANA, "{ itens: isso não é json");
    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
  });
});

describe("POST /v1/transactions/bulk-delete: exclusão em lote", () => {
  test("exclui as transações pedidas e devolve { afetadas, naoEncontradas }", async () => {
    const a = await inserir("ana", { descricao: "A" });
    const b = await inserir("ana", { descricao: "B" });
    const fica = await inserir("ana", { descricao: "fica" });
    const resposta = await excluir([a, b]);

    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { afetadas: 2, naoEncontradas: [] });
    assert.equal(await doBanco(a), null);
    assert.equal(await doBanco(b), null);
    assert.notEqual(await doBanco(fica), null, "o que não foi pedido continua");
  });

  test("uma transação só também vale (lote de um item)", async () => {
    const id = await inserir("ana");
    assert.deepEqual(await json(await excluir([id])), { afetadas: 1, naoEncontradas: [] });
    assert.equal(await total(), 0);
  });

  test("não é tudo ou nada: o que existe é excluído e o que não existe volta em naoEncontradas", async () => {
    const existe = await inserir("ana");
    const resposta = await excluir([existe, ID_INEXISTENTE]);
    assert.deepEqual(await json(resposta), { afetadas: 1, naoEncontradas: [ID_INEXISTENTE] });
    assert.equal(await total(), 0);
  });

  test("excluir de novo a mesma transação: já não é encontrada", async () => {
    const id = await inserir("ana");
    await excluir([id]);
    assert.deepEqual(await json(await excluir([id])), { afetadas: 0, naoEncontradas: [id] });
  });

  test("transação de outro usuário não é excluída e conta como não encontrada", async () => {
    const doBeto = await inserir("beto");
    const resposta = await excluir([doBeto], ANA);
    assert.deepEqual(await json(resposta), { afetadas: 0, naoEncontradas: [doBeto] });
    assert.notEqual(await doBanco(doBeto), null);
    assert.equal((await json(await chamar("GET", "/transactions", BETO))).total, 1);
  });

  test("as excluídas somem da listagem e saem do resumo", async () => {
    const grande = await inserir("ana", { tipo: "despesa", valor: 500 });
    await inserir("ana", { tipo: "despesa", valor: 40 });
    await excluir([grande]);

    const corpo = await json(await chamar("GET", "/transactions", ANA));
    assert.equal(corpo.total, 1);
    assert.deepEqual(corpo.resumo, { receitas: 0, despesas: 40, saldo: -40 });
  });

  test("lote com 100 ids (o máximo) é aceito", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => i.toString(16).padStart(24, "0"));
    const resposta = await excluir(ids);
    assert.equal(resposta.status, 200);
    assert.equal((await json(resposta)).naoEncontradas.length, 100);
  });

  test("sem token: 401 UNAUTHENTICATED e nada é excluído", async () => {
    await inserir("ana");
    const resposta = await excluir([ID_INEXISTENTE], null);
    assert.equal(resposta.status, 401);
    assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    assert.equal(await total(), 1);
  });
});

describe("POST /v1/transactions/bulk-delete: validação (400 VALIDATION_ERROR, e nada é excluído)", () => {
  const casos: { nome: string; ids: unknown }[] = [
    { nome: "sem o corpo", ids: undefined },
    { nome: "lista vazia", ids: [] },
    { nome: "mais de 100 ids", ids: Array.from({ length: 101 }, (_, i) => i.toString(16).padStart(24, "0")) },
    { nome: "ids repetidos", ids: [ID_INEXISTENTE, ID_INEXISTENTE] },
    { nome: "id mal formado", ids: ["abc"] },
    { nome: "id que não é texto", ids: [123] },
    { nome: "ids fora de uma lista", ids: ID_INEXISTENTE },
  ];

  for (const { nome, ids } of casos) {
    test(nome, async () => {
      await inserir("ana");
      const resposta = await excluir(ids);
      assert.equal(resposta.status, 400);
      assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
      assert.equal(await total(), 1);
    });
  }

  test("um id inválido no meio recusa o lote inteiro: nada é excluído", async () => {
    const valido = await inserir("ana");
    const resposta = await excluir([valido, "abc"]);
    assert.equal(resposta.status, 400);
    assert.notEqual(await doBanco(valido), null);
  });
});
