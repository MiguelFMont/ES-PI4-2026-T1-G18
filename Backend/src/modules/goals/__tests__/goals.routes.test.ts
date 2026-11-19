// src/modules/goals/__tests__/goals.routes.test.ts
// /v1/goals de ponta a ponta no Backend (issues #28, #29, #30, #40, #65, #66): CRUD das metas, progresso calculado com as
// transações que o usuário VINCULOU a cada meta (o Servidor Java é simulado aqui) e isolamento entre usuários.
// O vínculo em si (pela API de transações) é testado em vinculo.routes.test.ts.
import { ANA, BETO, ID_INEXISTENTE, diasAFrente, diasAtras, inicioDoDiaUtc, inserir, json, prepararApi, simularServidorGrupo5, textoDe } from "./apoio";
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { GoalModel } from "../goals.model";
import { TransactionModel } from "../../transactions/transactions.model";

const { chamar, chamarComTexto } = prepararApi();

// `null` = chamada sem login (um parâmetro padrão trocaria o undefined pelo token da Ana)
const api = (metodo: string, caminho: string, corpo?: unknown, token: string | null = ANA) =>
  chamar(metodo, `/goals${caminho}`, token ?? undefined, corpo);

const META = () => ({ titulo: "Viagem", valorObjetivo: 10000, prazo: diasAFrente(181).toISOString() });
const criar = async (corpo: Record<string, unknown> = META(), token: string | null = ANA) => json(await api("POST", "", corpo, token));
// um aporte: uma transação do usuário vinculada à meta (grava direto no banco, sem passar pela API de transações)
const aportar = (metaId: string, valor: number, extra: Record<string, unknown> = {}, userId = "ana") =>
  inserir(userId, { metaId, valor, data: inicioDoDiaUtc(), ...extra } as any);

describe("POST /v1/goals: criar", () => {
  test("cria a meta (201) com o progresso: sem transações vinculadas, só o valor inicial conta", async () => {
    const pedidos = simularServidorGrupo5();
    const resposta = await api("POST", "", { ...META(), valorInicial: 2500 });
    const meta = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.match(meta.id, /^[a-f\d]{24}$/);
    assert.equal(meta.titulo, "Viagem");
    assert.equal(meta.valorObjetivo, 10000);
    assert.equal(meta.valorInicial, 2500);
    assert.equal(meta.valorAportado, 0);
    assert.equal(meta.quantidadeAportes, 0);
    assert.equal(meta.valorAtual, 2500);
    assert.equal(meta.percentual, 25);
    assert.equal(meta.falta, 7500);
    assert.equal(meta.concluida, false);
    assert.equal(meta.noPrazo, true);
    assert.equal(meta.mesesRestantes, 7);
    assert.equal(meta.aporteMensalNecessario, 1071.43);
    assert.deepEqual(pedidos.map((p) => p.tipo), ["PedidoProgressoMeta"]);
    assert.deepEqual(pedidos[0].dados, { valorAtual: 2500, valorObjetivo: 10000, prazo: meta.prazo });
  });

  test("a resposta não expõe dados internos (userId, _id, __v) e não traz data de início nem saldo geral", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    for (const campo of ["userId", "_id", "__v", "updatedAt", "dataInicio", "saldoDesdeInicio"]) assert.ok(!(campo in meta), campo);
  });

  test("sem valorInicial, vale 0", async () => {
    simularServidorGrupo5();
    assert.equal((await criar()).valorInicial, 0);
  });

  test("transações sem vínculo NÃO contam para a meta (o saldo geral não entra mais)", async () => {
    simularServidorGrupo5();
    await inserir("ana", { tipo: "receita", valor: 9000, data: inicioDoDiaUtc() });
    await inserir("ana", { tipo: "despesa", valor: 300, data: inicioDoDiaUtc() });
    const meta = await criar();
    assert.equal(meta.valorAtual, 0);
  });

  test("meta já atingida só com o valor inicial: 100%, concluída e sem aporte necessário", async () => {
    simularServidorGrupo5();
    const meta = await criar({ ...META(), valorInicial: 12000 });
    assert.equal(meta.percentual, 100);
    assert.equal(meta.concluida, true);
    assert.equal(meta.falta, 0);
    assert.equal(meta.aporteMensalNecessario, 0);
  });

  test("o prazo de hoje ainda vale", async () => {
    simularServidorGrupo5();
    const meta = await criar({ ...META(), prazo: inicioDoDiaUtc().toISOString() });
    assert.equal(meta.noPrazo, true);
    assert.equal(meta.diasRestantes, 0);
  });

  test("o título é aparado", async () => {
    simularServidorGrupo5();
    assert.equal((await criar({ ...META(), titulo: "  Reserva  " })).titulo, "Reserva");
  });

  test("grava no banco para o usuário do token (o dono nunca vem do corpo)", async () => {
    simularServidorGrupo5();
    await criar({ ...META(), userId: "beto" });
    assert.equal((await GoalModel.findOne().lean())?.userId, "ana");
  });

  test("Servidor Java fora do ar: 503 e nada é salvo", async () => {
    simularServidorGrupo5({ indisponivel: true });
    const resposta = await api("POST", "", META());
    assert.equal(resposta.status, 503);
    assert.equal((await json(resposta)).error.code, "JAVA_SERVER_UNAVAILABLE");
    assert.equal(await GoalModel.countDocuments(), 0);
  });
});

describe("POST /v1/goals: validação (400 VALIDATION_ERROR, e nada é salvo)", () => {
  const casos: { nome: string; corpo: () => Record<string, unknown>; campo: string }[] = [
    { nome: "sem título", corpo: () => ({ ...META(), titulo: undefined }), campo: "titulo" },
    { nome: "título só com espaços", corpo: () => ({ ...META(), titulo: "   " }), campo: "titulo" },
    { nome: "título com 101 caracteres", corpo: () => ({ ...META(), titulo: textoDe(101) }), campo: "titulo" },
    { nome: "valor objetivo zero", corpo: () => ({ ...META(), valorObjetivo: 0 }), campo: "valorObjetivo" },
    { nome: "valor objetivo negativo", corpo: () => ({ ...META(), valorObjetivo: -1 }), campo: "valorObjetivo" },
    { nome: "valor objetivo como texto", corpo: () => ({ ...META(), valorObjetivo: "10" }), campo: "valorObjetivo" },
    { nome: "valor inicial negativo", corpo: () => ({ ...META(), valorInicial: -5 }), campo: "valorInicial" },
    { nome: "sem prazo", corpo: () => ({ ...META(), prazo: undefined }), campo: "prazo" },
    { nome: "prazo inválido", corpo: () => ({ ...META(), prazo: "amanhã" }), campo: "prazo" },
  ];

  for (const { nome, corpo, campo } of casos) {
    test(nome, async () => {
      simularServidorGrupo5();
      const resposta = await api("POST", "", corpo());
      const erro = (await json(resposta)).error;

      assert.equal(resposta.status, 400);
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.[campo]), `details deve apontar o campo ${campo}`);
      assert.equal(await GoalModel.countDocuments(), 0);
    });
  }

  test("prazo no passado: 400, mesmo o corpo sendo válido", async () => {
    simularServidorGrupo5();
    const resposta = await api("POST", "", { ...META(), prazo: diasAtras(1).toISOString() });
    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    assert.equal(await GoalModel.countDocuments(), 0);
  });

  test("corpo que não é JSON: 400", async () => {
    const resposta = await chamarComTexto("POST", "/goals", ANA, "{ isso não é json");
    assert.equal(resposta.status, 400);
  });
});

describe("GET /v1/goals e GET /v1/goals/:id", () => {
  test("sem metas: lista vazia", async () => {
    simularServidorGrupo5();
    const resposta = await api("GET", "");
    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), []);
  });

  test("cada usuário vê só as próprias metas", async () => {
    simularServidorGrupo5();
    await criar({ ...META(), titulo: "da Ana" }, ANA);
    await criar({ ...META(), titulo: "do Beto" }, BETO);

    assert.deepEqual((await json(await api("GET", "", undefined, ANA))).map((m: any) => m.titulo), ["da Ana"]);
    assert.deepEqual((await json(await api("GET", "", undefined, BETO))).map((m: any) => m.titulo), ["do Beto"]);
  });

  test("o prazo mais próximo vem primeiro", async () => {
    simularServidorGrupo5();
    await criar({ ...META(), titulo: "longe", prazo: diasAFrente(400).toISOString() });
    await criar({ ...META(), titulo: "perto", prazo: diasAFrente(30).toISOString() });
    await criar({ ...META(), titulo: "meio", prazo: diasAFrente(120).toISOString() });

    assert.deepEqual((await json(await api("GET", ""))).map((m: any) => m.titulo), ["perto", "meio", "longe"]);
  });

  test("meta com prazo vencido (criada antes): fora do prazo", async () => {
    simularServidorGrupo5();
    await GoalModel.create({ userId: "ana", titulo: "Antiga", valorObjetivo: 1000, valorInicial: 0, prazo: diasAtras(10) });
    const [meta] = await json(await api("GET", ""));
    assert.equal(meta.noPrazo, false);
    assert.equal(meta.diasRestantes, 0);
  });

  test("o progresso soma só as transações vinculadas a ESTA meta (despesa soma, receita subtrai)", async () => {
    simularServidorGrupo5();
    const a = await criar({ ...META(), titulo: "A", valorInicial: 1000 });
    const b = await criar({ ...META(), titulo: "B" });
    await aportar(a.id, 500, { tipo: "despesa" });
    await aportar(a.id, 250, { tipo: "receita" });
    await aportar(b.id, 4000);
    await inserir("ana", { valor: 9999, data: inicioDoDiaUtc() }); // sem vínculo: não conta

    const metas = await json(await api("GET", ""));
    const daA = metas.find((m: any) => m.id === a.id);
    const daB = metas.find((m: any) => m.id === b.id);
    assert.equal(daA.valorAportado, 250, "500 guardados - 250 retirados");
    assert.equal(daA.quantidadeAportes, 2);
    assert.equal(daA.valorAtual, 1250);
    assert.equal(daA.percentual, 12.5);
    assert.equal(daB.valorAportado, 4000);
    assert.equal(daB.valorAtual, 4000, "cada meta tem o seu saldo: o aporte de uma não aparece na outra");
  });

  test("transações com data no futuro ainda não contam como aporte", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    await aportar(meta.id, 5000, { data: diasAFrente(5) });
    assert.equal((await json(await api("GET", `/${meta.id}`))).valorAportado, 0);
  });

  test("transação de OUTRO usuário vinculada ao id da meta não conta (o filtro é por usuário)", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    await aportar(meta.id, 5000, {}, "beto");
    assert.equal((await json(await api("GET", `/${meta.id}`))).valorAportado, 0);
  });

  test("o progresso é recalculado a cada leitura: novo aporte, ou aporte excluído, muda a meta", async () => {
    simularServidorGrupo5();
    const { id } = await criar();
    assert.equal((await json(await api("GET", `/${id}`))).valorAtual, 0);

    const primeiro = await aportar(id, 4000);
    assert.equal((await json(await api("GET", `/${id}`))).percentual, 40);

    await aportar(id, 1000);
    assert.equal((await json(await api("GET", ""))).find((m: any) => m.id === id).valorAtual, 5000);

    await TransactionModel.deleteOne({ _id: primeiro });
    assert.equal((await json(await api("GET", `/${id}`))).valorAtual, 1000);
  });

  test("meta de outro usuário ou inexistente: 404 GOAL_NOT_FOUND", async () => {
    simularServidorGrupo5();
    const doBeto = await criar(META(), BETO);
    for (const id of [doBeto.id, ID_INEXISTENTE]) {
      const resposta = await api("GET", `/${id}`);
      assert.equal(resposta.status, 404);
      assert.equal((await json(resposta)).error.code, "GOAL_NOT_FOUND");
    }
  });

  test("id mal formado: 400 VALIDATION_ERROR", async () => {
    const resposta = await api("GET", "/abc");
    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
  });
});

describe("PATCH /v1/goals/:id: editar", () => {
  test("altera só os campos enviados e recalcula o progresso com os aportes", async () => {
    simularServidorGrupo5();
    const meta = await criar({ ...META(), valorInicial: 500 });
    await aportar(meta.id, 1500);

    const resposta = await api("PATCH", `/${meta.id}`, { valorObjetivo: 4000 });
    const editada = await json(resposta);

    assert.equal(resposta.status, 200);
    assert.equal(editada.valorObjetivo, 4000);
    assert.equal(editada.valorAtual, 2000);
    assert.equal(editada.percentual, 50);
    for (const campo of ["titulo", "valorInicial", "prazo"]) assert.equal(editada[campo], meta[campo], campo);
  });

  test("troca o título", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    assert.equal((await json(await api("PATCH", `/${meta.id}`, { titulo: "Casa própria" }))).titulo, "Casa própria");
    assert.equal((await GoalModel.findById(meta.id).lean())?.titulo, "Casa própria");
  });

  test("troca o prazo para uma data futura", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    const novo = diasAFrente(400).toISOString();
    assert.equal((await json(await api("PATCH", `/${meta.id}`, { prazo: novo }))).prazo, novo);
  });

  test("prazo no passado é recusado e nada muda", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    const resposta = await api("PATCH", `/${meta.id}`, { prazo: diasAtras(5).toISOString() });
    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    assert.equal((await GoalModel.findById(meta.id).lean())?.prazo.toISOString(), meta.prazo, "nada foi alterado");
  });

  test("editar outros campos de uma meta já vencida não exige mudar o prazo", async () => {
    simularServidorGrupo5();
    const antiga = await GoalModel.create({ userId: "ana", titulo: "Antiga", valorObjetivo: 1000, valorInicial: 0, prazo: diasAtras(10) });
    const resposta = await api("PATCH", `/${antiga._id}`, { titulo: "Antiga renomeada" });
    assert.equal(resposta.status, 200);
    assert.equal((await json(resposta)).titulo, "Antiga renomeada");
  });

  test("corpo sem nenhum campo conhecido: 400", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    for (const corpo of [{}, { userId: "beto" }, { dataInicio: "2026-01-01" }]) {
      assert.equal((await api("PATCH", `/${meta.id}`, corpo)).status, 400, JSON.stringify(corpo));
    }
  });

  test("valores inválidos: 400 e nada muda", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    for (const corpo of [{ valorObjetivo: 0 }, { valorInicial: -1 }, { titulo: " " }, { prazo: "ontem" }]) {
      assert.equal((await api("PATCH", `/${meta.id}`, corpo)).status, 400, JSON.stringify(corpo));
    }
    assert.equal((await GoalModel.findById(meta.id).lean())?.valorObjetivo, 10000);
  });

  test("meta de outro usuário: 404 e a meta dele não muda", async () => {
    simularServidorGrupo5();
    const doBeto = await criar({ ...META(), titulo: "do Beto" }, BETO);
    const resposta = await api("PATCH", `/${doBeto.id}`, { titulo: "invadida" }, ANA);
    assert.equal(resposta.status, 404);
    assert.equal((await json(resposta)).error.code, "GOAL_NOT_FOUND");
    assert.equal((await GoalModel.findById(doBeto.id).lean())?.titulo, "do Beto");
  });

  test("Servidor Java fora do ar: 503 e a meta continua como estava", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    // os dublês não empilham: desfaz o anterior antes de simular o Servidor fora do ar
    mock.restoreAll();
    simularServidorGrupo5({ indisponivel: true });

    const resposta = await api("PATCH", `/${meta.id}`, { titulo: "outra" });
    assert.equal(resposta.status, 503);
    assert.equal((await GoalModel.findById(meta.id).lean())?.titulo, "Viagem");
  });
});

describe("DELETE /v1/goals/:id: excluir", () => {
  test("exclui (204) e a meta some da lista", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    const resposta = await api("DELETE", `/${meta.id}`);
    assert.equal(resposta.status, 204);
    assert.equal(await GoalModel.countDocuments(), 0);
    assert.deepEqual(await json(await api("GET", "")), []);
  });

  test("as transações vinculadas continuam no extrato, só deixam de apontar para a meta", async () => {
    simularServidorGrupo5();
    const meta = await criar();
    const outra = await criar({ ...META(), titulo: "outra" });
    const transacao = await aportar(meta.id, 700);
    const daOutra = await aportar(outra.id, 100);
    await api("DELETE", `/${meta.id}`);

    assert.equal(await TransactionModel.countDocuments(), 2, "nenhuma transação é apagada");
    assert.ok(!("metaId" in (await TransactionModel.findById(transacao).lean())!), "o vínculo some");
    assert.equal((await TransactionModel.findById(daOutra).lean())?.metaId, outra.id, "o vínculo da outra meta continua");
  });

  test("meta de outro usuário, inexistente ou já excluída: 404 GOAL_NOT_FOUND", async () => {
    simularServidorGrupo5();
    const doBeto = await criar(META(), BETO);
    const propria = await criar();
    await api("DELETE", `/${propria.id}`);

    for (const id of [doBeto.id, ID_INEXISTENTE, propria.id]) {
      const resposta = await api("DELETE", `/${id}`);
      assert.equal(resposta.status, 404, id);
      assert.equal((await json(resposta)).error.code, "GOAL_NOT_FOUND");
    }
    assert.equal(await GoalModel.countDocuments({ userId: "beto" }), 1, "a meta do Beto continua");
  });

  test("não desvincula as transações quando a meta nem foi excluída (de outro usuário)", async () => {
    simularServidorGrupo5();
    const doBeto = await criar(META(), BETO);
    const t = await aportar(doBeto.id, 100, {}, "beto");
    await api("DELETE", `/${doBeto.id}`, undefined, ANA);
    assert.equal((await TransactionModel.findById(t).lean())?.metaId, doBeto.id);
  });

  test("id mal formado: 400", async () => {
    assert.equal((await api("DELETE", "/abc")).status, 400);
  });
});

describe("autenticação", () => {
  test("sem token: 401 UNAUTHENTICATED em todas as rotas, e nada é criado", async () => {
    const chamadas: [string, string, unknown?][] = [
      ["GET", ""], ["POST", "", META()], ["GET", `/${ID_INEXISTENTE}`], ["PATCH", `/${ID_INEXISTENTE}`, { titulo: "x" }], ["DELETE", `/${ID_INEXISTENTE}`],
    ];
    for (const [metodo, caminho, corpo] of chamadas) {
      const resposta = await api(metodo, caminho, corpo, null);
      assert.equal(resposta.status, 401, `${metodo} ${caminho}`);
      assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    }
    assert.equal(await GoalModel.countDocuments(), 0);
  });
});
