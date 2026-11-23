/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/transactions/__tests__/contas-transferencias.routes.test.ts
// Lançamentos ligados a contas e transferências (issues #104, #105, #107, #113): contaId obrigatório (RN4 e RN5), filtro e
// resposta com a conta, POST /transactions/transfers (RN6 e RN7), edição e exclusão de transferências (RN9) e os totais que
// ignoram transferências.
import { ANA, BETO, CONTAS, ID_INEXISTENTE, TRANSACAO_VALIDA, inserir, json, prepararApi, tokenDe } from "./apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { simularCategorizacao, simularPluggy } from "../../connected-accounts/__tests__/apoio";
import { UserModel } from "../../auth/auth.model";
import { AccountModel } from "../../accounts/accounts.model";
import { CardModel } from "../../investments/investments.model";
import { ConnectedAccountModel } from "../../connected-accounts/connected-accounts.model";
import { dashboardRepository } from "../../dashboard/dashboard.repository";
import { TransactionModel } from "../transactions.model";

const { chamar, chamarCru } = prepararApi();

const novaConta = async (nome: string, token: string = ANA, extra: Record<string, unknown> = {}) =>
  json(await chamar("POST", "/accounts", token, { nome, banco: "outro", saldoInicial: 0, ...extra }));
const saldoDe = async (id: string, token: string = ANA) =>
  (await json(await chamar("GET", "/accounts", token))).find((c: any) => c.id === id).saldoAtual;
const transferir = (corpo: Record<string, unknown>, token: string = ANA) =>
  chamar("POST", "/transactions/transfers", token, { valor: 100, data: "2026-10-10T12:00:00.000Z", ...corpo });

describe("POST /v1/transactions: conta do lançamento (RN4 e RN5)", () => {
  test("sem contaId: 400 VALIDATION_ERROR", async () => {
    simularCategorizacao();
    const resposta = await chamarCru("POST", "/transactions", ANA, TRANSACAO_VALIDA);
    assert.equal(resposta.status, 400);
    assert.ok((await json(resposta)).error.details.contaId);
  });

  test("RN4: usuário sem nenhuma conta recebe 422 ACCOUNT_REQUIRED e nada é gravado", async () => {
    await AccountModel.deleteMany({});
    const resposta = await chamarCru("POST", "/transactions", ANA, { ...TRANSACAO_VALIDA, contaId: ID_INEXISTENTE });
    assert.equal(resposta.status, 422);
    assert.equal((await json(resposta)).error.code, "ACCOUNT_REQUIRED");
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("conta que não existe, ou é de outro usuário: 404 ACCOUNT_NOT_FOUND", async () => {
    const inexistente = await chamarCru("POST", "/transactions", ANA, { ...TRANSACAO_VALIDA, contaId: ID_INEXISTENTE });
    assert.equal(inexistente.status, 404);
    assert.equal((await json(inexistente)).error.code, "ACCOUNT_NOT_FOUND");
    const doBeto = await chamarCru("POST", "/transactions", ANA, { ...TRANSACAO_VALIDA, contaId: CONTAS.beto });
    assert.equal(doBeto.status, 404);
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("grava a conta e devolve contaId e conta { id, nome, banco, bancoNome }", async () => {
    const reserva = await novaConta("Reserva", ANA, { banco: "itau" });
    const criada = await json(await chamar("POST", "/transactions", ANA, { ...TRANSACAO_VALIDA, contaId: reserva.id }));
    assert.equal(criada.contaId, reserva.id);
    assert.deepEqual(criada.conta, { id: reserva.id, nome: "Reserva", banco: "itau", bancoNome: "Itaú" });
    assert.equal((await TransactionModel.findById(criada.id).lean())?.contaId, reserva.id);
  });

  test("o lançamento muda o saldo da conta: receita soma, despesa subtrai", async () => {
    simularCategorizacao();
    const reserva = await novaConta("Reserva", ANA, { saldoInicial: 200 });
    await chamar("POST", "/transactions", ANA, { ...TRANSACAO_VALIDA, tipo: "receita", valor: 50, contaId: reserva.id });
    await chamar("POST", "/transactions", ANA, { ...TRANSACAO_VALIDA, valor: 20.5, contaId: reserva.id });
    assert.equal(await saldoDe(reserva.id), 229.5);
  });
});

describe("GET /v1/transactions: conta", () => {
  test("filtro contaId: as lançadas na conta e as transferências que chegaram a ela", async () => {
    const reserva = await novaConta("Reserva");
    await inserir("ana", { descricao: "na corrente", contaId: CONTAS.ana });
    await inserir("ana", { descricao: "na reserva", contaId: reserva.id });
    await inserir("ana", { tipo: "transferencia", descricao: "para a reserva", contaId: CONTAS.ana, contaDestinoId: reserva.id });

    const daReserva = await json(await chamar("GET", `/transactions?contaId=${reserva.id}`, ANA));
    assert.deepEqual(daReserva.itens.map((t: any) => t.descricao).sort(), ["na reserva", "para a reserva"]);
    const daCorrente = await json(await chamar("GET", `/transactions?contaId=${CONTAS.ana}`, ANA));
    assert.deepEqual(daCorrente.itens.map((t: any) => t.descricao).sort(), ["na corrente", "para a reserva"]);
  });

  test("cada item traz a conta; a transferência traz também a conta de destino", async () => {
    const reserva = await novaConta("Reserva");
    await inserir("ana", { tipo: "transferencia", contaId: CONTAS.ana, contaDestinoId: reserva.id });
    const { itens } = await json(await chamar("GET", "/transactions", ANA));
    assert.equal(itens[0].conta.nome, "Conta corrente");
    assert.equal(itens[0].contaDestino.nome, "Reserva");
    assert.equal(itens[0].contaDestinoId, reserva.id);
  });

  test("filtro tipo=transferencia e contaId mal formado (400)", async () => {
    await inserir("ana", { tipo: "transferencia", contaId: CONTAS.ana, contaDestinoId: ID_INEXISTENTE });
    await inserir("ana");
    const so = await json(await chamar("GET", "/transactions?tipo=transferencia", ANA));
    assert.equal(so.total, 1);
    assert.equal((await chamar("GET", "/transactions?contaId=abc", ANA)).status, 400);
  });

  test("RN6: o resumo (receitas, despesas e saldo) ignora as transferências", async () => {
    await inserir("ana", { tipo: "receita", valor: 1000 });
    await inserir("ana", { tipo: "despesa", valor: 300 });
    await inserir("ana", { tipo: "transferencia", valor: 5000, contaId: CONTAS.ana, contaDestinoId: ID_INEXISTENTE });
    const { resumo, total } = await json(await chamar("GET", "/transactions", ANA));
    assert.equal(total, 3, "a transferência aparece na lista");
    assert.deepEqual(resumo, { receitas: 1000, despesas: 300, saldo: 700 });
  });
});

describe("POST /v1/transactions/transfers", () => {
  test("cria um único registro de tipo transferencia (201), sem receita nem despesa", async () => {
    const reserva = await novaConta("Reserva");
    const resposta = await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id, descricao: "Guardar", observacoes: "do mês" });
    const t = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.equal(t.tipo, "transferencia");
    assert.equal(t.valor, 100);
    assert.equal(t.descricao, "Guardar");
    assert.equal(t.observacoes, "do mês");
    assert.equal(t.categoria, "Transferência");
    assert.equal(t.origem, "manual");
    assert.equal(t.conta.nome, "Conta corrente");
    assert.equal(t.contaDestino.nome, "Reserva");
    assert.equal(await TransactionModel.countDocuments(), 1);
    for (const interno of ["userId", "_id", "__v"]) assert.ok(!(interno in t), interno);
  });

  test("descrição em branco vira 'Transferência'", async () => {
    const reserva = await novaConta("Reserva");
    const t = await json(await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id, descricao: "  " }));
    assert.equal(t.descricao, "Transferência");
  });

  test("RN6 e RN9: subtrai da origem e soma no destino; excluir a transferência devolve os saldos", async () => {
    simularCategorizacao();
    const reserva = await novaConta("Reserva", ANA, { saldoInicial: 10 });
    await inserir("ana", { tipo: "receita", valor: 500, contaId: CONTAS.ana });
    const t = await json(await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id, valor: 120 }));
    assert.equal(await saldoDe(CONTAS.ana), 380);
    assert.equal(await saldoDe(reserva.id), 130);

    await chamar("POST", "/transactions/bulk-delete", ANA, { ids: [t.id] });
    assert.equal(await saldoDe(CONTAS.ana), 500);
    assert.equal(await saldoDe(reserva.id), 10);
  });

  test("não entra nos totais do painel (receitas e despesas do mês)", async () => {
    const reserva = await novaConta("Reserva");
    await inserir("ana", { tipo: "receita", valor: 100, data: new Date() as any });
    await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id, valor: 900, data: new Date().toISOString() });

    assert.deepEqual(await dashboardRepository.getTotaisDoMes("ana"), { receitas: 100, despesas: 0 });
    assert.deepEqual(await dashboardRepository.getTotaisPorCategoria("ana"), []);
    const porMes = await dashboardRepository.getTotaisPorMes("ana", new Date(Date.now() - 40 * 86_400_000));
    assert.ok(porMes.every((g) => g._id.tipo !== "transferencia"));
  });

  test("contas iguais: 400", async () => {
    const resposta = await transferir({ contaId: CONTAS.ana, contaDestinoId: CONTAS.ana });
    assert.equal(resposta.status, 400);
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("validação: valor positivo, data válida, ids bem formados, descrição até 100 e observação até 300", async () => {
    const reserva = await novaConta("Reserva");
    const par = { contaId: CONTAS.ana, contaDestinoId: reserva.id };
    const ruins = [
      { ...par, valor: 0 },
      { ...par, valor: -5 },
      { ...par, valor: "10" },
      { ...par, data: "ontem" },
      { ...par, contaDestinoId: "abc" },
      { contaDestinoId: reserva.id },
      { contaId: CONTAS.ana },
      { ...par, descricao: "x".repeat(101) },
      { ...par, observacoes: "x".repeat(301) },
    ];
    for (const corpo of ruins) assert.equal((await transferir(corpo)).status, 400, JSON.stringify(corpo));
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("conta que não existe, ou é de outro usuário (origem ou destino): 404 ACCOUNT_NOT_FOUND", async () => {
    const reserva = await novaConta("Reserva");
    for (const par of [
      { contaId: ID_INEXISTENTE, contaDestinoId: reserva.id },
      { contaId: CONTAS.ana, contaDestinoId: ID_INEXISTENTE },
      { contaId: CONTAS.beto, contaDestinoId: reserva.id },
      { contaId: CONTAS.ana, contaDestinoId: CONTAS.beto },
    ]) {
      const resposta = await transferir(par);
      assert.equal(resposta.status, 404, JSON.stringify(par));
      assert.equal((await json(resposta)).error.code, "ACCOUNT_NOT_FOUND");
    }
  });

  test("RN7: conta Open Finance na origem ou no destino: 422 TRANSFER_NOT_ALLOWED", async () => {
    const conexao = await ConnectedAccountModel.create({
      userId: "ana",
      pluggyItemId: "item-1",
      connectorId: 2,
      instituicao: "Pluggy Bank",
      status: "UPDATED",
      contas: [{ pluggyAccountId: "c1", tipo: "BANK", nome: "Corrente", saldo: 10 }],
    });
    simularCategorizacao();
    const aberta = (await json(await chamar("GET", "/accounts", ANA))).find((c: any) => c.tipo === "open_finance");
    assert.ok(aberta, "a migração cria a conta Open Finance da conexão");
    assert.equal(aberta.conectadaId, String(conexao._id));

    for (const par of [
      { contaId: CONTAS.ana, contaDestinoId: aberta.id },
      { contaId: aberta.id, contaDestinoId: CONTAS.ana },
    ]) {
      const resposta = await transferir(par);
      assert.equal(resposta.status, 422);
      assert.equal((await json(resposta)).error.code, "TRANSFER_NOT_ALLOWED");
    }
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("exige login", async () => {
    assert.equal((await chamar("POST", "/transactions/transfers", undefined, {})).status, 401);
  });

  test("a rota /transfers não é confundida com um id", async () => {
    assert.notEqual((await transferir({})).status, 404);
  });
});

describe("PATCH /v1/transactions/bulk: contas", () => {
  const editar = (id: string, alteracoes: Record<string, unknown>, token: string = ANA) =>
    chamar("PATCH", "/transactions/bulk", token, { itens: [{ id, alteracoes }] });

  test("mover um lançamento manual para outra conta (RN8: é assim que se libera uma conta para excluir)", async () => {
    simularCategorizacao();
    const reserva = await novaConta("Reserva");
    const id = await inserir("ana", { valor: 40, contaId: CONTAS.ana });
    const resposta = await editar(id, { contaId: reserva.id });
    assert.equal((await json(resposta)).afetadas, 1);
    assert.equal((await TransactionModel.findById(id).lean())?.contaId, reserva.id);
    assert.equal((await chamar("DELETE", `/accounts/${CONTAS.ana}`, ANA)).status, 200);
  });

  test("mover para conta inexistente ou de outro usuário: 404 e nada é alterado", async () => {
    const id = await inserir("ana", { contaId: CONTAS.ana });
    assert.equal((await editar(id, { contaId: ID_INEXISTENTE })).status, 404);
    assert.equal((await editar(id, { contaId: CONTAS.beto })).status, 404);
    assert.equal((await TransactionModel.findById(id).lean())?.contaId, CONTAS.ana);
  });

  test("lançamento importado da Pluggy não muda de conta (422: do Open Finance só se edita descrição, categoria e meta)", async () => {
    const reserva = await novaConta("Reserva");
    const id = await inserir("ana", { origem: "pluggy", externalId: "e1", contaId: CONTAS.ana });
    assert.equal((await editar(id, { contaId: reserva.id })).status, 422);
  });

  test("RN9: editar o valor e a data de uma transferência recalcula os dois saldos", async () => {
    simularCategorizacao();
    const reserva = await novaConta("Reserva");
    const t = await json(await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id, valor: 100 }));
    const resposta = await editar(t.id, { valor: 250, data: "2026-10-20T00:00:00.000Z", descricao: "Maior", observacoes: "ajuste" });
    assert.equal(resposta.status, 200);
    assert.equal(await saldoDe(CONTAS.ana), -250);
    assert.equal(await saldoDe(reserva.id), 250);
    const gravada = await TransactionModel.findById(t.id).lean();
    assert.equal(gravada?.descricao, "Maior");
    assert.equal(gravada?.tipo, "transferencia");
  });

  test("trocar a origem e o destino de uma transferência: valida contas (404), manuais (422) e diferentes (400)", async () => {
    const reserva = await novaConta("Reserva");
    const outra = await novaConta("Outra");
    const t = await json(await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id }));

    assert.equal((await editar(t.id, { contaDestinoId: outra.id })).status, 200);
    assert.equal((await TransactionModel.findById(t.id).lean())?.contaDestinoId, outra.id);
    assert.equal((await editar(t.id, { contaDestinoId: CONTAS.ana })).status, 400, "origem igual ao destino");
    assert.equal((await editar(t.id, { contaId: outra.id })).status, 400, "origem igual ao destino atual");
    assert.equal((await editar(t.id, { contaDestinoId: CONTAS.beto })).status, 404);
  });

  test("transferência não vira receita/despesa nem ganha categoria, forma de pagamento, meta ou cartão (400)", async () => {
    const reserva = await novaConta("Reserva");
    const t = await json(await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id }));
    for (const alteracoes of [{ tipo: "despesa" }, { categoria: "Lazer" }, { formaPagamento: "pix" }, { metaId: null }, { parcelas: 2 }]) {
      assert.equal((await editar(t.id, alteracoes)).status, 400, JSON.stringify(alteracoes));
    }
  });

  test("lançamento comum não tem conta de destino (400) e não vira transferência", async () => {
    const id = await inserir("ana", { contaId: CONTAS.ana });
    assert.equal((await editar(id, { contaDestinoId: CONTAS.ana })).status, 400);
    assert.equal((await editar(id, { tipo: "transferencia" })).status, 400);
  });
});

describe("POST /v1/transactions/:id/duplicate: contas", () => {
  test("a cópia fica na mesma conta; duplicar uma transferência copia origem e destino", async () => {
    const reserva = await novaConta("Reserva");
    const comum = await inserir("ana", { contaId: reserva.id });
    const copia = await json(await chamar("POST", `/transactions/${comum}/duplicate`, ANA));
    assert.equal(copia.contaId, reserva.id);
    assert.equal(copia.conta.nome, "Reserva");

    const t = await json(await transferir({ contaId: CONTAS.ana, contaDestinoId: reserva.id }));
    const copiaT = await json(await chamar("POST", `/transactions/${t.id}/duplicate`, ANA));
    assert.equal(copiaT.tipo, "transferencia");
    assert.equal(copiaT.contaId, CONTAS.ana);
    assert.equal(copiaT.contaDestinoId, reserva.id);
  });
});

describe("importação da Pluggy: conta", () => {
  test("RN5: com a conta Open Finance da conexão criada, as transações importadas ficam ligadas a ela", async () => {
    const usuario = await UserModel.create({ nome: "Pro", email: "p@teste.com", cpf: "11122233344", senhaHash: "x", plano: "pro" });
    const pro = tokenDe(String(usuario._id));
    simularPluggy();
    simularCategorizacao();

    const conectada = await json(await chamar("POST", "/connected-accounts/sandbox", pro));
    const conta = (await json(await chamar("GET", "/accounts", pro))).find((c: any) => c.tipo === "open_finance");
    assert.ok(conta, "a conexão vira conta Open Finance");
    assert.equal(conta.conectadaId, conectada.conta.id);

    await chamar("POST", `/connected-accounts/${conectada.conta.id}/sync`, pro);
    const importadas = await TransactionModel.find({ userId: String(usuario._id), origem: "pluggy" }).lean();
    assert.ok(importadas.length > 0);
    assert.ok(importadas.every((t) => t.contaId === conta.id));
  });
});

describe("conta Open Finance: sem lançamento manual e vira manual ao desconectar", () => {
  async function usuarioProComConexao() {
    const usuario = await UserModel.create({ nome: "Pro", email: "of@teste.com", cpf: "55566677788", senhaHash: "x", plano: "pro" });
    const pro = tokenDe(String(usuario._id));
    simularPluggy();
    simularCategorizacao();
    const conectada = await json(await chamar("POST", "/connected-accounts/sandbox", pro));
    const contas = await json(await chamar("GET", "/accounts", pro));
    return { pro, idUsuario: String(usuario._id), conectada, aberta: contas.find((c: any) => c.tipo === "open_finance") };
  }

  test("lançamento manual numa conta Open Finance é recusado (422 MANUAL_ENTRY_NOT_ALLOWED), e mover um lançamento para ela também", async () => {
    const { pro, idUsuario, aberta } = await usuarioProComConexao();
    const manual = await json(await chamar("POST", "/accounts", pro, { nome: "Carteira", banco: "outro" }));

    const resposta = await chamarCru("POST", "/transactions", pro, { ...TRANSACAO_VALIDA, contaId: aberta.id });
    assert.equal(resposta.status, 422);
    assert.equal((await json(resposta)).error.code, "MANUAL_ENTRY_NOT_ALLOWED");

    const criada = await json(await chamar("POST", "/transactions", pro, { ...TRANSACAO_VALIDA, contaId: manual.id }));
    const mover = await chamar("PATCH", "/transactions/bulk", pro, { itens: [{ id: criada.id, alteracoes: { contaId: aberta.id } }] });
    assert.equal(mover.status, 422);
    assert.equal(await TransactionModel.countDocuments({ userId: idUsuario, origem: "manual", contaId: aberta.id }), 0);
  });

  test("desconectar a conexão transforma a conta em manual, sem mudar o saldo atual, e ela passa a aceitar lançamentos e edição", async () => {
    const { pro, conectada, aberta } = await usuarioProComConexao();
    await chamar("POST", `/connected-accounts/${conectada.conta.id}/sync`, pro);
    const antes = (await json(await chamar("GET", "/accounts", pro))).find((c: any) => c.id === aberta.id);

    assert.equal((await chamar("DELETE", `/connected-accounts/${conectada.conta.id}`, pro)).status, 204);
    const depois = (await json(await chamar("GET", "/accounts", pro))).find((c: any) => c.id === aberta.id);

    assert.equal(depois.tipo, "manual");
    assert.ok(!("conectadaId" in depois));
    assert.equal(depois.saldoAtual, antes.saldoAtual, "o saldo continua o último que o banco informou");
    assert.equal((await chamar("PATCH", `/accounts/${aberta.id}`, pro, { nome: "Agora manual" })).status, 200);
    assert.equal((await chamarCru("POST", "/transactions", pro, { ...TRANSACAO_VALIDA, contaId: aberta.id })).status, 201);
  });
});

describe("conectar o Open Finance cria o cartão de crédito da conexão", () => {
  test("cada conta CREDIT da Pluggy vira um cartão (limite e fechamento da Pluggy), ligado à conta Open Finance e sem se repetir", async () => {
    const usuario = await UserModel.create({ nome: "Pro", email: "cc@teste.com", cpf: "99900011122", senhaHash: "x", plano: "pro" });
    const pro = tokenDe(String(usuario._id));
    simularPluggy();
    simularCategorizacao();

    const conectada = await json(await chamar("POST", "/connected-accounts/sandbox", pro));
    const aberta = (await json(await chamar("GET", "/accounts", pro))).find((c: any) => c.tipo === "open_finance");
    const cartoes = await CardModel.find({ userId: String(usuario._id) }).lean();

    assert.equal(cartoes.length, 1, "a conexão do sandbox tem um cartão de crédito");
    assert.equal(cartoes[0].nome, "Mastercard Black");
    assert.equal(cartoes[0].limite, 300000);
    assert.equal(cartoes[0].diaFechamento, 9);
    assert.equal(cartoes[0].contaId, aberta.id);

    await chamar("POST", `/connected-accounts/${conectada.conta.id}/sync`, pro);
    await chamar("GET", "/accounts", pro);
    assert.equal(await CardModel.countDocuments({ userId: String(usuario._id) }), 1, "sincronizar e listar não repetem o cartão");
  });
});

describe("transação do Open Finance: só descrição, categoria, meta e observação se editam", () => {
  const editar = (id: string, alteracoes: Record<string, unknown>) =>
    chamar("PATCH", "/transactions/bulk", ANA, { itens: [{ id, alteracoes }] });

  test("valor, pagamento, tipo, data, conta e observação: 422 OPEN_FINANCE_READ_ONLY e nada muda; descrição e categoria passam", async () => {
    const id = await inserir("ana", { origem: "pluggy", externalId: "x1", valor: 50 });

    for (const alteracoes of [{ valor: 60 }, { formaPagamento: "pix" }, { tipo: "receita" }, { data: "2026-10-20" }, { contaId: CONTAS.ana }]) {
      const resposta = await editar(id, alteracoes);
      assert.equal(resposta.status, 422, JSON.stringify(alteracoes));
      assert.equal((await json(resposta)).error.code, "OPEN_FINANCE_READ_ONLY");
    }
    assert.equal((await TransactionModel.findById(id).lean())?.valor, 50);

    assert.equal((await editar(id, { descricao: "Mercado do bairro", categoria: "Lazer", observacoes: "conferir" })).status, 200);
    const gravada = await TransactionModel.findById(id).lean();
    assert.equal(gravada?.descricao, "Mercado do bairro");
    assert.equal(gravada?.categoria, "Lazer");
    assert.equal(gravada?.observacoes, "conferir");
  });

  test("um lote com uma transação do Open Finance e uma manual: o lote inteiro é recusado se pedir um campo proibido", async () => {
    const doBanco = await inserir("ana", { origem: "pluggy", externalId: "x2" });
    const manual = await inserir("ana", { valor: 10 });
    const resposta = await chamar("PATCH", "/transactions/bulk", ANA, {
      itens: [{ id: manual, alteracoes: { valor: 11 } }, { id: doBanco, alteracoes: { valor: 11 } }],
    });
    assert.equal(resposta.status, 422);
    assert.equal((await TransactionModel.findById(manual).lean())?.valor, 10, "a manual também não mudou");
  });
});
