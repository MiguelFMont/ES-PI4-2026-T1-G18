// src/modules/investments/__tests__/cartoes.routes.test.ts
// Vários cartões de crédito por usuário (/v1/investments/cards): CRUD e limite de 5, nome único, isolamento entre usuários,
// fatura e limite de cada cartão, parcelamentos ligados a um cartão, exclusão, rotas antigas (/card = cartão padrão) e a
// migração dos dados do tempo de "um cartão por usuário". O Servidor Java é simulado (calculos em goals/__tests__/apoio.ts).
import { ANA, BETO, ID_INEXISTENTE, inserir, json, prepararApi, simularServidorGrupo5, textoDe } from "../../goals/__tests__/apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CardInstallmentModel, CardModel, MAX_CARTOES } from "../investments.model";
import { investmentsRepository } from "../investments.repository";
import { TransactionModel } from "../../transactions/transactions.model";

const { chamar } = prepararApi();

// `null` = chamada sem login (um parâmetro padrão trocaria o undefined pelo token da Ana)
const api = (metodo: string, caminho: string, corpo?: unknown, token: string | null = ANA) =>
  chamar(metodo, `/investments${caminho}`, token ?? undefined, corpo);

const criarCartao = async (corpo: Record<string, unknown>, token: string | null = ANA) => json(await api("POST", "/cards", corpo, token));
const listar = async (token: string | null = ANA) => json(await api("GET", "/cards", undefined, token));
const criarParcelamento = async (corpo: Record<string, unknown>, token: string | null = ANA) =>
  json(await api("POST", "/card/installments", corpo, token));

// ------------------------------------------------------------------------------------------------ listar

describe("GET /v1/investments/cards: listar os cartões", () => {
  test("quem não tem cartão recebe o padrão chamado Cartão (limite 5000, vence dia 10), uma vez só", async () => {
    simularServidorGrupo5();
    const primeira = await listar();
    await listar();

    assert.equal(primeira.cartoes.length, 1);
    const [cartao] = primeira.cartoes;
    assert.match(cartao.id, /^[a-f\d]{24}$/);
    assert.equal(cartao.nome, "Cartão");
    assert.equal(cartao.padrao, true);
    assert.equal(cartao.limite, 5000);
    assert.equal(cartao.diaVencimento, 10);
    assert.equal(cartao.limiteDisponivel, 5000);
    assert.equal(cartao.saldoDevedor, 0);
    assert.equal(cartao.parcelamentosAtivos, 0);
    assert.equal(cartao.fatura.valor, 0);
    assert.match(cartao.fatura.vencimento, /^\d{4}-\d{2}-10$/);
    assert.equal(primeira.maximo, MAX_CARTOES);
    assert.deepEqual(primeira.totais, { limite: 5000, limiteDisponivel: 5000, saldoDevedor: 0, faturaDoMes: 0 });
    assert.equal(await CardModel.countDocuments(), 1);
  });

  test("lista do mais antigo (o padrão) para o mais novo, com os totais de todos os cartões", async () => {
    simularServidorGrupo5();
    await criarCartao({ nome: "Nubank", limite: 3000, diaVencimento: 5 });
    await criarCartao({ nome: "Inter", limite: 2000, diaVencimento: 20 });
    const r = await listar();

    assert.deepEqual(r.cartoes.map((c: any) => c.nome), ["Nubank", "Inter"]);
    assert.deepEqual(r.cartoes.map((c: any) => c.padrao), [true, false]);
    assert.deepEqual(r.totais, { limite: 5000, limiteDisponivel: 5000, saldoDevedor: 0, faturaDoMes: 0 });
  });

  test("cada usuário vê só os próprios cartões", async () => {
    simularServidorGrupo5();
    await criarCartao({ nome: "da Ana" }, ANA);
    await criarCartao({ nome: "do Beto" }, BETO);
    assert.deepEqual((await listar(ANA)).cartoes.map((c: any) => c.nome), ["da Ana"]);
    assert.deepEqual((await listar(BETO)).cartoes.map((c: any) => c.nome), ["do Beto"]);
  });

  test("Servidor Java fora do ar: 503", async () => {
    simularServidorGrupo5({ indisponivel: true });
    const resposta = await api("GET", "/cards");
    assert.equal(resposta.status, 503);
    assert.equal((await json(resposta)).error.code, "JAVA_SERVER_UNAVAILABLE");
  });
});

// ------------------------------------------------------------------------------------------------ criar

describe("POST /v1/investments/cards: criar cartão", () => {
  test("cria (201) com nome, limite e vencimento, já com a fatura", async () => {
    simularServidorGrupo5();
    const resposta = await api("POST", "/cards", { nome: "Nubank", limite: 8000, diaVencimento: 25 });
    const cartao = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.equal(cartao.nome, "Nubank");
    assert.equal(cartao.limite, 8000);
    assert.equal(cartao.diaVencimento, 25);
    assert.equal(cartao.limiteDisponivel, 8000);
    assert.equal(cartao.padrao, true, "o primeiro cartão do usuário é o padrão");
    assert.match(cartao.fatura.vencimento, /^\d{4}-\d{2}-25$/);
  });

  test("só o nome é obrigatório: limite 5000 e vencimento dia 10 por padrão; espaços nas pontas saem do nome", async () => {
    simularServidorGrupo5();
    const cartao = await criarCartao({ nome: "  Itaú  " });
    assert.equal(cartao.nome, "Itaú");
    assert.equal(cartao.limite, 5000);
    assert.equal(cartao.diaVencimento, 10);
  });

  test("o primeiro cartão criado é o único: o padrão 'Cartão' não é criado junto", async () => {
    simularServidorGrupo5();
    await criarCartao({ nome: "Nubank" });
    assert.equal(await CardModel.countDocuments(), 1);
    assert.deepEqual((await listar()).cartoes.map((c: any) => c.nome), ["Nubank"]);
  });

  test(`até ${MAX_CARTOES} cartões por usuário: o seguinte responde 409 CARD_LIMIT_REACHED e nada é salvo`, async () => {
    simularServidorGrupo5();
    for (let i = 1; i <= MAX_CARTOES; i++) assert.equal((await api("POST", "/cards", { nome: `Cartão ${i}` })).status, 201);

    const resposta = await api("POST", "/cards", { nome: "Excedente" });
    assert.equal(resposta.status, 409);
    assert.equal((await json(resposta)).error.code, "CARD_LIMIT_REACHED");
    assert.equal(await CardModel.countDocuments({ userId: "ana" }), MAX_CARTOES);

    // o limite é por usuário
    assert.equal((await api("POST", "/cards", { nome: "Cartão 1" }, BETO)).status, 201);
  });

  test("excluir um cartão libera uma vaga", async () => {
    simularServidorGrupo5();
    const criados = [];
    for (let i = 1; i <= MAX_CARTOES; i++) criados.push(await criarCartao({ nome: `Cartão ${i}` }));
    assert.equal((await api("DELETE", `/cards/${criados[4].id}`)).status, 204);
    assert.equal((await api("POST", "/cards", { nome: "Novo" })).status, 201);
  });

  test("nome único por usuário, sem diferenciar maiúsculas: 409 CARD_NAME_TAKEN (e o mesmo nome vale para outro usuário)", async () => {
    simularServidorGrupo5();
    await criarCartao({ nome: "Nubank" });
    for (const nome of ["Nubank", "NUBANK", " nubank "]) {
      const resposta = await api("POST", "/cards", { nome });
      assert.equal(resposta.status, 409, nome);
      assert.equal((await json(resposta)).error.code, "CARD_NAME_TAKEN");
    }
    assert.equal(await CardModel.countDocuments({ userId: "ana" }), 1);
    assert.equal((await api("POST", "/cards", { nome: "Nubank" }, BETO)).status, 201);
  });

  test("o índice único do banco também segura duas criações com o mesmo nome", async () => {
    await CardModel.init();
    await CardModel.create({ userId: "ana", nome: "Nubank", nomeChave: "nubank", limite: 1, diaVencimento: 1 });
    await assert.rejects(CardModel.create({ userId: "ana", nome: "NUBANK", nomeChave: "nubank", limite: 1, diaVencimento: 1 }), { code: 11000 });
  });

  const invalidos: { nome: string; corpo: Record<string, unknown>; campo: string }[] = [
    { nome: "sem nome", corpo: { limite: 1000 }, campo: "nome" },
    { nome: "nome só com espaços", corpo: { nome: "   " }, campo: "nome" },
    { nome: "nome com 41 caracteres", corpo: { nome: textoDe(41) }, campo: "nome" },
    { nome: "nome como número", corpo: { nome: 7 }, campo: "nome" },
    { nome: "limite zero", corpo: { nome: "X", limite: 0 }, campo: "limite" },
    { nome: "limite negativo", corpo: { nome: "X", limite: -1 }, campo: "limite" },
    { nome: "limite como texto", corpo: { nome: "X", limite: "1000" }, campo: "limite" },
    { nome: "dia 0", corpo: { nome: "X", diaVencimento: 0 }, campo: "diaVencimento" },
    { nome: "dia 29", corpo: { nome: "X", diaVencimento: 29 }, campo: "diaVencimento" },
    { nome: "dia fracionado", corpo: { nome: "X", diaVencimento: 1.5 }, campo: "diaVencimento" },
  ];
  for (const { nome, corpo, campo } of invalidos) {
    test(`validação: ${nome} (400 VALIDATION_ERROR, nada salvo)`, async () => {
      simularServidorGrupo5();
      const resposta = await api("POST", "/cards", corpo);
      const erro = (await json(resposta)).error;
      assert.equal(resposta.status, 400);
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.[campo]), `details deve apontar ${campo}`);
      assert.equal(await CardModel.countDocuments(), 0);
    });
  }

  test("grava para o usuário do token (o dono nunca vem do corpo)", async () => {
    simularServidorGrupo5();
    await criarCartao({ nome: "X", userId: "beto" });
    assert.equal((await CardModel.findOne().lean())?.userId, "ana");
  });
});

// ------------------------------------------------------------------------------------------------ ler e editar

describe("GET e PATCH /v1/investments/cards/:id", () => {
  test("GET devolve o cartão com a fatura", async () => {
    simularServidorGrupo5();
    const criado = await criarCartao({ nome: "Nubank", limite: 3000 });
    const cartao = await json(await api("GET", `/cards/${criado.id}`));
    assert.equal(cartao.id, criado.id);
    assert.equal(cartao.limite, 3000);
    assert.equal(cartao.fatura.valor, 0);
  });

  test("PATCH muda nome, limite e dia de vencimento (juntos ou separados)", async () => {
    simularServidorGrupo5();
    const { id } = await criarCartao({ nome: "Nubank", limite: 3000, diaVencimento: 5 });

    const tudo = await json(await api("PATCH", `/cards/${id}`, { nome: "Nubank Roxo", limite: 9000, diaVencimento: 27 }));
    assert.equal(tudo.nome, "Nubank Roxo");
    assert.equal(tudo.limite, 9000);
    assert.equal(tudo.diaVencimento, 27);
    assert.equal(tudo.limiteDisponivel, 9000);

    const so = await json(await api("PATCH", `/cards/${id}`, { limite: 100 }));
    assert.equal(so.nome, "Nubank Roxo");
    assert.equal(so.diaVencimento, 27);
    assert.equal((await CardModel.findById(id).lean())?.nomeChave, "nubank roxo");
  });

  test("PATCH pode trocar só as maiúsculas do próprio nome", async () => {
    simularServidorGrupo5();
    const { id } = await criarCartao({ nome: "nubank" });
    const cartao = await json(await api("PATCH", `/cards/${id}`, { nome: "Nubank" }));
    assert.equal(cartao.nome, "Nubank");
  });

  test("PATCH com o nome de outro cartão do usuário: 409 CARD_NAME_TAKEN e nada muda", async () => {
    simularServidorGrupo5();
    await criarCartao({ nome: "Nubank" });
    const inter = await criarCartao({ nome: "Inter" });
    const resposta = await api("PATCH", `/cards/${inter.id}`, { nome: "NUBANK", limite: 1 });
    assert.equal(resposta.status, 409);
    assert.equal((await json(resposta)).error.code, "CARD_NAME_TAKEN");
    assert.equal((await CardModel.findById(inter.id).lean())?.limite, 5000);
  });

  const invalidos: [string, Record<string, unknown>][] = [
    ["corpo vazio", {}],
    ["só campos desconhecidos", { userId: "beto" }],
    ["nome em branco", { nome: " " }],
    ["nome com 41 caracteres", { nome: textoDe(41) }],
    ["limite zero", { limite: 0 }],
    ["dia 29", { diaVencimento: 29 }],
  ];
  for (const [nome, corpo] of invalidos) {
    test(`PATCH inválido: ${nome} (400)`, async () => {
      simularServidorGrupo5();
      const { id } = await criarCartao({ nome: "Nubank" });
      assert.equal((await api("PATCH", `/cards/${id}`, corpo)).status, 400);
    });
  }

  test("cartão de outro usuário, inexistente ou id mal formado: 404 CARD_NOT_FOUND / 400, e o do dono não muda", async () => {
    simularServidorGrupo5();
    const doBeto = await criarCartao({ nome: "do Beto", limite: 700 }, BETO);

    for (const [metodo, corpo] of [["GET", undefined], ["PATCH", { limite: 1 }], ["DELETE", undefined]] as const) {
      for (const id of [doBeto.id, ID_INEXISTENTE]) {
        const resposta = await api(metodo, `/cards/${id}`, corpo, ANA);
        assert.equal(resposta.status, 404, `${metodo} ${id}`);
        assert.equal((await json(resposta)).error.code, "CARD_NOT_FOUND");
      }
      assert.equal((await api(metodo, "/cards/abc", corpo)).status, 400, `${metodo} id mal formado`);
    }
    const intacto = await CardModel.findById(doBeto.id).lean();
    assert.equal(intacto?.limite, 700);
  });
});

// ------------------------------------------------------------------------------------------------ fatura e limite por cartão

describe("fatura e limite de cada cartão", () => {
  test("cada cartão soma só as próprias compras no crédito; as sem cartão vão para o mais antigo", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A", limite: 5000 });
    const b = await criarCartao({ nome: "B", limite: 2000 });
    const agora = new Date();
    await inserir("ana", { tipo: "despesa", valor: 300, formaPagamento: "credito", data: agora, cartaoId: b.id });
    await inserir("ana", { tipo: "despesa", valor: 100, formaPagamento: "credito", data: agora });
    await inserir("ana", { tipo: "despesa", valor: 50, formaPagamento: "credito", data: agora, cartaoId: a.id });
    await inserir("ana", { tipo: "despesa", valor: 999, formaPagamento: "debito", data: agora });
    await inserir("ana", { tipo: "receita", valor: 777, formaPagamento: "credito", data: agora, cartaoId: b.id });
    await inserir("beto", { tipo: "despesa", valor: 444, formaPagamento: "credito", data: agora });

    const { cartoes, totais } = await listar();
    const [ca, cb] = cartoes;
    assert.equal(ca.fatura.comprasNoCredito, 150, "50 do A + 100 sem cartão");
    assert.equal(ca.limiteDisponivel, 4850);
    assert.equal(cb.fatura.comprasNoCredito, 300);
    assert.equal(cb.limiteDisponivel, 1700);
    assert.equal(totais.faturaDoMes, 450);
    assert.equal(totais.limiteDisponivel, 6550);
  });

  test("parcelamentos pertencem a um cartão: as parcelas e o saldo devedor entram só na fatura e no limite dele", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A", limite: 5000 });
    const b = await criarCartao({ nome: "B", limite: 4000 });
    const p = await criarParcelamento({ cartaoId: b.id, descricao: "Sofá", valorTotal: 1200, parcelas: 12 });
    assert.equal(p.cartaoId, b.id);

    const { cartoes } = await listar();
    const [ca, cb] = cartoes;
    assert.equal(ca.fatura.parcelasDoMes, 0);
    assert.equal(ca.limiteDisponivel, 5000);
    assert.equal(ca.parcelamentosAtivos, 0);
    assert.equal(cb.fatura.parcelasDoMes, 100);
    assert.equal(cb.fatura.valor, 100);
    assert.equal(cb.saldoDevedor, 1200);
    assert.equal(cb.limiteDisponivel, 2800);
    assert.equal(cb.parcelamentosAtivos, 1);
    assert.notEqual(a.id, b.id);
  });

  test("o parcelamento sem cartaoId vai para o cartão mais antigo", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A" });
    await criarCartao({ nome: "B" });
    const p = await criarParcelamento({ descricao: "Geladeira", valorTotal: 600, parcelas: 6 });
    assert.equal(p.cartaoId, a.id);
    assert.equal((await CardInstallmentModel.findById(p.id).lean())?.cartaoId, a.id);
  });

  test("parcelamento num cartão de outro usuário ou inexistente: 404 CARD_NOT_FOUND e nada é salvo", async () => {
    simularServidorGrupo5();
    const doBeto = await criarCartao({ nome: "do Beto" }, BETO);
    for (const cartaoId of [doBeto.id, ID_INEXISTENTE]) {
      const resposta = await api("POST", "/card/installments", { cartaoId, descricao: "X", valorTotal: 10, parcelas: 2 });
      assert.equal(resposta.status, 404);
      assert.equal((await json(resposta)).error.code, "CARD_NOT_FOUND");
    }
    assert.equal(await CardInstallmentModel.countDocuments(), 0);
  });

  test("GET /card/installments traz todos (com o cartão de cada um) e aceita ?cartaoId= para um cartão só", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A" });
    const b = await criarCartao({ nome: "B" });
    await criarParcelamento({ cartaoId: a.id, descricao: "do A", valorTotal: 100, parcelas: 2 });
    await criarParcelamento({ cartaoId: b.id, descricao: "do B", valorTotal: 300, parcelas: 3 });

    const todos = await json(await api("GET", "/card/installments"));
    assert.deepEqual(todos.parcelamentos.map((p: any) => [p.descricao, p.cartaoId]), [["do A", a.id], ["do B", b.id]]);
    assert.equal(todos.totalSaldoDevedor, 400);

    const soB = await json(await api("GET", `/card/installments?cartaoId=${b.id}`));
    assert.deepEqual(soB.parcelamentos.map((p: any) => p.descricao), ["do B"]);
    assert.equal(soB.totalSaldoDevedor, 300);

    assert.equal((await api("GET", `/card/installments?cartaoId=${ID_INEXISTENTE}`)).status, 404);
    assert.equal((await api("GET", "/card/installments?cartaoId=abc")).status, 400);
  });

  test("parcelamento antigo (sem cartaoId) conta para o cartão mais antigo e aparece com o cartaoId dele", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A" });
    await criarCartao({ nome: "B" });
    await CardInstallmentModel.collection.insertOne({ userId: "ana", descricao: "Antigo", valorTotal: 1000, parcelas: 10, parcelasPagas: 0, taxaJurosMensal: 0 });

    const { parcelamentos } = await json(await api("GET", "/card/installments"));
    assert.equal(parcelamentos[0].cartaoId, a.id);
    const { cartoes } = await listar();
    assert.equal(cartoes[0].saldoDevedor, 1000);
    assert.equal(cartoes[1].saldoDevedor, 0);
  });
});

// ------------------------------------------------------------------------------------------------ excluir

describe("DELETE /v1/investments/cards/:id", () => {
  test("exclui (204) um cartão sem parcelamentos", async () => {
    simularServidorGrupo5();
    await criarCartao({ nome: "A" });
    const b = await criarCartao({ nome: "B" });
    assert.equal((await api("DELETE", `/cards/${b.id}`)).status, 204);
    assert.deepEqual((await listar()).cartoes.map((c: any) => c.nome), ["A"]);
  });

  test("com parcelamento ainda ativo: 409 CARD_HAS_INSTALLMENTS e o cartão continua", async () => {
    simularServidorGrupo5();
    const b = await criarCartao({ nome: "B" });
    await criarParcelamento({ cartaoId: b.id, descricao: "Sofá", valorTotal: 1200, parcelas: 12, parcelasPagas: 2 });

    const resposta = await api("DELETE", `/cards/${b.id}`);
    assert.equal(resposta.status, 409);
    assert.equal((await json(resposta)).error.code, "CARD_HAS_INSTALLMENTS");
    assert.equal(await CardModel.countDocuments(), 1);
    assert.equal(await CardInstallmentModel.countDocuments(), 1);
  });

  test("com parcelamento quitado: exclui o cartão e o parcelamento; as transações dele são desvinculadas", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A" });
    const b = await criarCartao({ nome: "B" });
    const quitado = await criarParcelamento({ cartaoId: b.id, descricao: "Quitado", valorTotal: 600, parcelas: 3, parcelasPagas: 3 });
    const doA = await criarParcelamento({ cartaoId: a.id, descricao: "Ativo do A", valorTotal: 100, parcelas: 2 });
    const idCompra = await inserir("ana", { formaPagamento: "credito", cartaoId: b.id });
    const idParcelada = await inserir("ana", { formaPagamento: "credito", cartaoId: b.id, parcelas: 3, parcelamentoId: quitado.id });
    const idDoA = await inserir("ana", { formaPagamento: "credito", cartaoId: a.id });

    assert.equal((await api("DELETE", `/cards/${b.id}`)).status, 204);

    assert.equal(await CardInstallmentModel.findById(quitado.id).lean(), null, "o parcelamento quitado saiu junto");
    assert.ok(await CardInstallmentModel.findById(doA.id).lean(), "o parcelamento do outro cartão ficou");
    const compra = await TransactionModel.findById(idCompra).lean();
    assert.equal(compra?.cartaoId, undefined);
    const parcelada = await TransactionModel.findById(idParcelada).lean();
    assert.equal(parcelada?.cartaoId, undefined);
    assert.equal(parcelada?.parcelamentoId, undefined);
    assert.equal(parcelada?.parcelas, 1, "a compra parcelada vira uma compra comum");
    assert.equal((await TransactionModel.findById(idDoA).lean())?.cartaoId, a.id);
  });

  test("excluir o último cartão: a próxima leitura volta a criar o padrão 'Cartão'", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A" });
    assert.equal((await api("DELETE", `/cards/${a.id}`)).status, 204);
    assert.deepEqual((await listar()).cartoes.map((c: any) => c.nome), ["Cartão"]);
  });

  test("não excluiu nada de outro usuário (404) e o cartão do dono continua", async () => {
    simularServidorGrupo5();
    const doBeto = await criarCartao({ nome: "do Beto" }, BETO);
    assert.equal((await api("DELETE", `/cards/${doBeto.id}`, undefined, ANA)).status, 404);
    assert.equal(await CardModel.countDocuments({ userId: "beto" }), 1);
  });
});

// ------------------------------------------------------------------------------------------------ rotas antigas (/card)

describe("/v1/investments/card: o cartão padrão (o mais antigo)", () => {
  test("GET /card devolve o cartão mais antigo, agora com id e nome", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A", limite: 3000 });
    await criarCartao({ nome: "B" });
    const cartao = await json(await api("GET", "/card"));
    assert.equal(cartao.id, a.id);
    assert.equal(cartao.nome, "A");
    assert.equal(cartao.limite, 3000);
    assert.equal(cartao.padrao, true);
  });

  test("PATCH /card altera só o cartão padrão", async () => {
    simularServidorGrupo5();
    const a = await criarCartao({ nome: "A", limite: 3000 });
    const b = await criarCartao({ nome: "B", limite: 4000 });
    const cartao = await json(await api("PATCH", "/card", { limite: 7000 }));
    assert.equal(cartao.id, a.id);
    assert.equal(cartao.limite, 7000);
    assert.equal((await CardModel.findById(b.id).lean())?.limite, 4000);
  });

  test("sem nenhum cartão, GET /card cria o padrão (comportamento de antes)", async () => {
    simularServidorGrupo5();
    const cartao = await json(await api("GET", "/card"));
    assert.equal(cartao.nome, "Cartão");
    assert.equal(cartao.limite, 5000);
  });
});

// ------------------------------------------------------------------------------------------------ migração

describe("migração dos dados de 'um cartão por usuário'", () => {
  test("remove o índice único antigo, dá o nome padrão ao cartão antigo e liga os parcelamentos antigos a ele", async () => {
    const colecao = CardModel.collection;
    await CardModel.init();
    await colecao.createIndex({ userId: 1 }, { unique: true, name: "userId_1" });
    await colecao.insertOne({ userId: "ana", limite: 7000, diaVencimento: 15 });
    await colecao.insertOne({ userId: "beto", limite: 1000, diaVencimento: 3 });
    await CardInstallmentModel.collection.insertOne({ userId: "ana", descricao: "Antigo", valorTotal: 100, parcelas: 2, parcelasPagas: 0, taxaJurosMensal: 0 });
    // com o índice antigo, um segundo cartão do mesmo usuário é impossível
    await assert.rejects(CardModel.create({ userId: "ana", nome: "Outro", nomeChave: "outro", limite: 1, diaVencimento: 1 }), { code: 11000 });

    await investmentsRepository.migrarCartoes();
    await investmentsRepository.migrarCartoes(); // idempotente

    assert.ok(!(await colecao.indexes()).some((i) => i.name === "userId_1"), "o índice antigo saiu");
    const ana = await CardModel.findOne({ userId: "ana" }).lean();
    assert.equal(ana?.nome, "Cartão");
    assert.equal(ana?.nomeChave, "cartão");
    assert.equal(ana?.limite, 7000, "limite e vencimento continuam os do cartão antigo");
    assert.equal(ana?.diaVencimento, 15);
    assert.equal((await CardInstallmentModel.findOne({ userId: "ana" }).lean())?.cartaoId, String(ana?._id));
    assert.equal(await CardModel.countDocuments(), 2, "ninguém ganhou cartão a mais");

    simularServidorGrupo5();
    assert.equal((await api("POST", "/cards", { nome: "Segundo" })).status, 201);
    const { cartoes } = await listar();
    assert.deepEqual(cartoes.map((c: any) => c.nome), ["Cartão", "Segundo"]);
    assert.equal(cartoes[0].limite, 7000);
    assert.equal(cartoes[0].saldoDevedor, 100);
  });

  test("em banco sem coleção de cartões, não faz nada e não falha", async () => {
    await assert.doesNotReject(investmentsRepository.migrarCartoes());
  });
});

// ------------------------------------------------------------------------------------------------ autenticação

describe("autenticação", () => {
  test("sem token: 401 UNAUTHENTICATED nas rotas de cartões, e nada é criado", async () => {
    const chamadas: [string, string, unknown?][] = [
      ["GET", "/cards"], ["POST", "/cards", { nome: "X" }], ["GET", `/cards/${ID_INEXISTENTE}`],
      ["PATCH", `/cards/${ID_INEXISTENTE}`, { limite: 1 }], ["DELETE", `/cards/${ID_INEXISTENTE}`],
    ];
    for (const [metodo, caminho, corpo] of chamadas) {
      const resposta = await api(metodo, caminho, corpo, null);
      assert.equal(resposta.status, 401, `${metodo} ${caminho}`);
      assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    }
    assert.equal(await CardModel.countDocuments(), 0);
  });
});
