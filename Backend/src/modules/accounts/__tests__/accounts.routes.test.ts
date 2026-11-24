/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/accounts/__tests__/accounts.routes.test.ts
// /v1/accounts de ponta a ponta (issues #101, #102, #103, #113): CRUD, lista de bancos, saldo calculado pelo Servidor Java
// (simulado), regra do plano Pro para contas Open Finance, exclusão com lançamentos e migração dos lançamentos antigos.
import { ANA, BETO, CONTAS, ID_INEXISTENTE, inserir, json, prepararApi, tokenDe } from "../../transactions/__tests__/apoio";
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { simularCategorizacao } from "../../connected-accounts/__tests__/apoio";
import { javaServerClient } from "../../../java-client/java-server.client";
import { calcularSaldoContas } from "../../transactions/__tests__/saldo-simulado";
import { ConnectedAccountModel } from "../../connected-accounts/connected-accounts.model";
import { UserModel } from "../../auth/auth.model";
import { TransactionModel } from "../../transactions/transactions.model";
import { AccountModel } from "../accounts.model";
import { CardModel } from "../../investments/investments.model";

const { chamar, chamarCru } = prepararApi();

const criarConta = (corpo: unknown, token: string = ANA) => chamar("POST", "/accounts", token, corpo);
const NOVA = { nome: "Reserva", banco: "inter", saldoInicial: 100 };

async function usuarioPro() {
  const usuario = await UserModel.create({ nome: "Pro", email: "pro@teste.com", cpf: "12345678900", senhaHash: "x", plano: "pro" });
  return tokenDe(String(usuario._id));
}

async function usuarioFree() {
  const usuario = await UserModel.create({ nome: "Free", email: "free@teste.com", cpf: "98765432100", senhaHash: "y" });
  return tokenDe(String(usuario._id));
}

const conexao = (userId: string, saldo = 2500.5) =>
  ConnectedAccountModel.create({
    userId,
    pluggyItemId: `item-${userId}`,
    connectorId: 2,
    instituicao: "Pluggy Bank",
    status: "UPDATED",
    contas: [
      { pluggyAccountId: "c1", tipo: "BANK", nome: "Conta corrente", saldo },
      { pluggyAccountId: "c2", tipo: "CREDIT", nome: "Cartão", saldo: -900 },
    ],
  });

describe("GET /v1/accounts/banks", () => {
  test("devolve a lista fixa de bancos (código e nome), com Outro no fim", async () => {
    const resposta = await chamar("GET", "/accounts/banks", ANA);
    const bancos = await json(resposta);
    assert.equal(resposta.status, 200);
    assert.equal(bancos.length, 10);
    assert.deepEqual(bancos[0], { codigo: "bb", nome: "Banco do Brasil" });
    assert.deepEqual(bancos.at(-1), { codigo: "outro", nome: "Outro" });
  });

  test("exige login", async () => {
    assert.equal((await chamar("GET", "/accounts/banks")).status, 401);
  });
});

describe("POST /v1/accounts: conta manual", () => {
  test("cria (201) e devolve a conta com o saldo atual igual ao inicial, sem expor dados internos", async () => {
    simularCategorizacao();
    const resposta = await criarConta(NOVA);
    const conta = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.match(conta.id, /^[a-f\d]{24}$/);
    assert.equal(conta.nome, "Reserva");
    assert.equal(conta.banco, "inter");
    assert.equal(conta.bancoNome, "Inter");
    assert.equal(conta.tipo, "manual");
    assert.equal(conta.saldoInicial, 100);
    assert.equal(conta.saldoAtual, 100);
    for (const interno of ["userId", "nomeChave", "_id", "__v"]) assert.ok(!(interno in conta), interno);
  });

  test("saldo inicial padrão é 0 e o nome perde os espaços das pontas", async () => {
    const conta = await json(await criarConta({ nome: "  Carteira ", banco: "outro" }));
    assert.equal(conta.nome, "Carteira");
    assert.equal(conta.saldoInicial, 0);
  });

  test("RN1: nome único por usuário sem diferenciar maiúsculas (409 ACCOUNT_NAME_IN_USE); outro usuário pode repetir", async () => {
    await criarConta(NOVA);
    const repetida = await criarConta({ ...NOVA, nome: "RESERVA" });
    assert.equal(repetida.status, 409);
    assert.equal((await json(repetida)).error.code, "ACCOUNT_NAME_IN_USE");
    assert.equal((await criarConta(NOVA, BETO)).status, 201);
  });

  test("validação: nome de 1 a 40 caracteres, banco da lista, saldo numérico", async () => {
    const ruins = [
      { ...NOVA, nome: "" },
      { ...NOVA, nome: "   " },
      { ...NOVA, nome: "x".repeat(41) },
      { ...NOVA, banco: "banco-inventado" },
      { nome: "Sem banco" },
      { ...NOVA, saldoInicial: "100" },
      { ...NOVA, tipo: "poupanca" },
      { ...NOVA, conectadaId: ID_INEXISTENTE }, // conta manual não tem conexão
    ];
    for (const corpo of ruins) {
      const resposta = await criarConta(corpo);
      assert.equal(resposta.status, 400, JSON.stringify(corpo));
      assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    }
    assert.equal((await criarConta({ ...NOVA, nome: "x".repeat(40) })).status, 201);
  });

  test("aceita saldo inicial negativo (cheque especial)", async () => {
    assert.equal((await json(await criarConta({ ...NOVA, saldoInicial: -250.5 }))).saldoAtual, -250.5);
  });

  test("exige login", async () => {
    assert.equal((await chamar("POST", "/accounts", undefined, NOVA)).status, 401);
  });
});

describe("GET /v1/accounts: saldo atual", () => {
  test("saldo = inicial + receitas - despesas, calculado pelo Servidor Java com os movimentos da conta", async () => {
    simularCategorizacao();
    const conta = await json(await criarConta({ ...NOVA, saldoInicial: 1000 }));
    await inserir("ana", { tipo: "receita", valor: 500, contaId: conta.id });
    await inserir("ana", { tipo: "despesa", valor: 120.25, contaId: conta.id });
    await inserir("ana", { tipo: "despesa", valor: 30, contaId: CONTAS.ana }); // outra conta: não conta
    await inserir("beto", { tipo: "despesa", valor: 999, contaId: conta.id }); // de outro usuário: não conta

    const lista = await json(await chamar("GET", "/accounts", ANA));
    const reserva = lista.find((c: any) => c.id === conta.id);
    assert.equal(reserva.saldoAtual, 1379.75);
    assert.equal(lista.find((c: any) => c.id === CONTAS.ana).saldoAtual, -30);
  });

  test("chama o Servidor Java com PedidoCalcularSaldoContas (contas manuais e movimentos)", async () => {
    const chamadas: { tipo: string; resposta: string; dados: any }[] = [];
    mock.method(javaServerClient, "enviarPedido", async (tipo: string, resposta: string, dados: any) => {
      chamadas.push({ tipo, resposta, dados });
      return calcularSaldoContas(dados);
    });
    await inserir("ana", { tipo: "receita", valor: 10, contaId: CONTAS.ana });

    await chamar("GET", "/accounts", ANA);
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].tipo, "PedidoCalcularSaldoContas");
    assert.equal(chamadas[0].resposta, "RespostaCalcularSaldoContas");
    assert.deepEqual(chamadas[0].dados.contas, [{ id: CONTAS.ana, saldoInicial: 0 }]);
    assert.deepEqual(chamadas[0].dados.movimentos, [{ tipo: "receita", valor: 10, contaId: CONTAS.ana }]);
  });

  test("Servidor Java fora do ar: 503 JAVA_SERVER_UNAVAILABLE", async () => {
    simularCategorizacao({ indisponivel: true });
    const resposta = await chamar("GET", "/accounts", ANA);
    assert.equal(resposta.status, 503);
  });

  test("não lista contas de outro usuário", async () => {
    simularCategorizacao();
    const lista = await json(await chamar("GET", "/accounts", BETO));
    assert.deepEqual(lista.map((c: any) => c.id), [CONTAS.beto]);
  });
});

describe("PATCH /v1/accounts/:id", () => {
  test("altera nome e banco (o saldo inicial não se altera depois de criada); o saldo atual vem junto", async () => {
    simularCategorizacao();
    const conta = await json(await criarConta(NOVA));
    await inserir("ana", { tipo: "despesa", valor: 40, contaId: conta.id });

    const resposta = await chamar("PATCH", `/accounts/${conta.id}`, ANA, { nome: "Reserva 2", banco: "itau", saldoInicial: 500 });
    const atualizada = await json(resposta);
    assert.equal(resposta.status, 200);
    assert.equal(atualizada.nome, "Reserva 2");
    assert.equal(atualizada.banco, "itau");
    assert.equal(atualizada.saldoInicial, 100, "o saldoInicial enviado é ignorado");
    assert.equal(atualizada.saldoAtual, 60);
    assert.equal((await chamar("PATCH", `/accounts/${conta.id}`, ANA, { saldoInicial: 500 })).status, 400, "só saldoInicial: nada a alterar");
  });

  test("renomear para o nome da própria conta (só mudando a caixa) é aceito; para o de outra conta, 409", async () => {
    simularCategorizacao();
    const conta = await json(await criarConta(NOVA));
    assert.equal((await chamar("PATCH", `/accounts/${conta.id}`, ANA, { nome: "RESERVA" })).status, 200);
    const conflito = await chamar("PATCH", `/accounts/${conta.id}`, ANA, { nome: "conta corrente" });
    assert.equal(conflito.status, 409);
    assert.equal((await json(conflito)).error.code, "ACCOUNT_NAME_IN_USE");
  });

  test("corpo vazio ou inválido: 400", async () => {
    const conta = await json(await criarConta(NOVA));
    assert.equal((await chamar("PATCH", `/accounts/${conta.id}`, ANA, {})).status, 400);
    assert.equal((await chamar("PATCH", `/accounts/${conta.id}`, ANA, { banco: "xx" })).status, 400);
  });

  test("conta inexistente ou de outro usuário: 404 ACCOUNT_NOT_FOUND; id mal formado: 400", async () => {
    const naoExiste = await chamar("PATCH", `/accounts/${ID_INEXISTENTE}`, ANA, { nome: "X" });
    assert.equal(naoExiste.status, 404);
    assert.equal((await json(naoExiste)).error.code, "ACCOUNT_NOT_FOUND");
    assert.equal((await chamar("PATCH", `/accounts/${CONTAS.ana}`, BETO, { nome: "X" })).status, 404);
    assert.equal((await chamar("PATCH", "/accounts/abc", ANA, { nome: "X" })).status, 400);
  });
});

describe("DELETE /v1/accounts/:id", () => {
  test("exclui uma conta sem lançamentos (200 com desfazerId)", async () => {
    const conta = await json(await criarConta(NOVA));
    const resposta = await chamar("DELETE", `/accounts/${conta.id}`, ANA);
    assert.equal(resposta.status, 200);
    assert.ok((await json(resposta)).desfazerId);
    assert.equal(await AccountModel.countDocuments({ _id: conta.id }), 0);
  });

  test("excluir a conta exclui os lançamentos dela (inclusive transferências) e o desfazer traz tudo de volta", async () => {
    const outra = await json(await criarConta(NOVA));
    await inserir("ana", { contaId: CONTAS.ana });
    await inserir("ana", { tipo: "transferencia", contaId: outra.id, contaDestinoId: CONTAS.ana });
    const idDeOutra = await inserir("ana", { contaId: outra.id });
    const resposta = await chamar("DELETE", `/accounts/${CONTAS.ana}`, ANA);
    assert.equal(resposta.status, 200);
    const corpo = await json(resposta);
    assert.equal(corpo.lancamentos, 2);
    assert.equal(await AccountModel.countDocuments({ _id: CONTAS.ana }), 0);
    assert.equal(await TransactionModel.countDocuments({ userId: "ana" }), 1, "só o lançamento da outra conta ficou");
    assert.ok(await TransactionModel.findById(idDeOutra).lean());

    assert.equal((await chamar("POST", `/undo/${corpo.desfazerId}`, ANA)).status, 200);
    assert.equal(await AccountModel.countDocuments({ _id: CONTAS.ana }), 1);
    assert.equal(await TransactionModel.countDocuments({ userId: "ana" }), 3);
    assert.equal((await chamar("POST", `/undo/${corpo.desfazerId}`, ANA)).status, 404, "só desfaz uma vez");
  });

  test("o desfazer de outro usuário é 404", async () => {
    const conta = await json(await criarConta(NOVA));
    const { desfazerId } = await json(await chamar("DELETE", `/accounts/${conta.id}`, ANA));
    assert.equal((await chamar("POST", `/undo/${desfazerId}`, BETO)).status, 404);
    assert.equal(await AccountModel.countDocuments({ _id: conta.id }), 0);
  });

  test("conta inexistente ou de outro usuário: 404", async () => {
    assert.equal((await chamar("DELETE", `/accounts/${ID_INEXISTENTE}`, ANA)).status, 404);
    assert.equal((await chamar("DELETE", `/accounts/${CONTAS.ana}`, BETO)).status, 404);
  });
});

describe("RN3: conta Open Finance (só plano Pro)", () => {
  test("plano Free: 403 PLAN_REQUIRED e nada é criado", async () => {
    const free = await usuarioFree();
    const antes = await AccountModel.countDocuments();
    const resposta = await criarConta({ nome: "Pluggy", banco: "outro", tipo: "open_finance", conectadaId: ID_INEXISTENTE }, free);
    assert.equal(resposta.status, 403);
    assert.equal((await json(resposta)).error.code, "PLAN_REQUIRED");
    assert.equal(await AccountModel.countDocuments(), antes);
  });

  test("usuário sem registro de plano (id que não é de usuário) conta como Free", async () => {
    const resposta = await criarConta({ nome: "Pluggy", banco: "outro", tipo: "open_finance", conectadaId: ID_INEXISTENTE });
    assert.equal(resposta.status, 403);
  });

  test("plano Pro: cria ligada à conexão; o saldo é o do provedor (soma das contas bancárias) e somente leitura", async () => {
    const pro = await usuarioPro();
    const idPro = String((await UserModel.findOne({ email: "pro@teste.com" }))!._id);
    const ligacao = await conexao(idPro, 2500.5);
    simularCategorizacao();

    const resposta = await criarConta(
      { nome: "Pluggy Bank", banco: "outro", tipo: "open_finance", conectadaId: String(ligacao._id), saldoInicial: 99999 },
      pro
    );
    const conta = await json(resposta);
    assert.equal(resposta.status, 201);
    assert.equal(conta.tipo, "open_finance");
    assert.equal(conta.conectadaId, String(ligacao._id));
    assert.equal(conta.saldoInicial, 2500.5, "o saldo informado pelo usuário não vale");
    assert.equal(conta.saldoAtual, 2500.5);

    const lista = await json(await chamar("GET", "/accounts", pro));
    assert.equal(lista.find((c: any) => c.id === conta.id).saldoAtual, 2500.5);

    const edicao = await chamar("PATCH", `/accounts/${conta.id}`, pro, { nome: "Outro nome" });
    assert.equal(edicao.status, 422);
    assert.equal((await json(edicao)).error.code, "ACCOUNT_READ_ONLY");
    assert.equal((await chamar("PATCH", `/accounts/${conta.id}`, pro, { nome: "Renomeada" })).status, 422, "conta Open Finance não se edita");
  });

  test("plano Pro: exige a conexão (400), que ela exista e seja do usuário (404) e que ainda não tenha conta (409)", async () => {
    const pro = await usuarioPro();
    const idPro = String((await UserModel.findOne({ email: "pro@teste.com" }))!._id);
    const semConexao = await criarConta({ nome: "Pluggy", banco: "outro", tipo: "open_finance" }, pro);
    assert.equal(semConexao.status, 400);
    assert.equal((await criarConta({ nome: "Pluggy", banco: "outro", tipo: "open_finance", conectadaId: ID_INEXISTENTE }, pro)).status, 404);

    const doBeto = await conexao("beto");
    assert.equal((await criarConta({ nome: "Pluggy", banco: "outro", tipo: "open_finance", conectadaId: String(doBeto._id) }, pro)).status, 404);

    const minha = await conexao(idPro);
    const corpo = { nome: "Pluggy", banco: "outro", tipo: "open_finance", conectadaId: String(minha._id) };
    assert.equal((await criarConta(corpo, pro)).status, 201);
    assert.equal((await criarConta({ ...corpo, nome: "Outra" }, pro)).status, 409);
  });

  test("os lançamentos já importados da conexão passam a ser da conta criada (RN5)", async () => {
    const pro = await usuarioPro();
    const idPro = String((await UserModel.findOne({ email: "pro@teste.com" }))!._id);
    const ligacao = await conexao(idPro);
    const importada = await inserir(idPro, { origem: "pluggy", contaConectadaId: String(ligacao._id), externalId: "x1", contaId: undefined });
    await TransactionModel.updateOne({ _id: importada }, { $unset: { contaId: "" } });
    simularCategorizacao();

    const conta = await json(
      await criarConta({ nome: "Pluggy", banco: "outro", tipo: "open_finance", conectadaId: String(ligacao._id) }, pro)
    );
    assert.equal((await TransactionModel.findById(importada).lean())?.contaId, conta.id);
  });
});

describe("RN10: migração dos dados antigos", () => {
  test("lançamentos sem conta vão para a 'Conta principal' (manual, banco Outro, saldo inicial 0), criada só se preciso", async () => {
    simularCategorizacao();
    await AccountModel.deleteMany({});
    assert.deepEqual(await json(await chamar("GET", "/accounts", ANA)), [], "sem lançamentos antigos, nenhuma conta é criada");

    const antigo = await TransactionModel.create({
      userId: "ana",
      tipo: "receita",
      valor: 300,
      categoria: "Salario",
      data: new Date("2026-10-01"),
      descricao: "Salário",
    });
    const lista = await json(await chamar("GET", "/accounts", ANA));
    assert.equal(lista.length, 1);
    assert.equal(lista[0].nome, "Conta principal");
    assert.equal(lista[0].tipo, "manual");
    assert.equal(lista[0].banco, "outro");
    assert.equal(lista[0].saldoInicial, 0);
    assert.equal(lista[0].saldoAtual, 300);
    assert.equal((await TransactionModel.findById(antigo._id).lean())?.contaId, lista[0].id);

    await chamar("GET", "/accounts", ANA); // idempotente
    assert.equal(await AccountModel.countDocuments({ userId: "ana" }), 1);
  });

  test("a listagem de transações também migra (e já mostra a conta do lançamento)", async () => {
    await AccountModel.deleteMany({});
    await TransactionModel.create({
      userId: "ana",
      tipo: "despesa",
      valor: 10,
      categoria: "Lazer",
      data: new Date("2026-10-01"),
      descricao: "Cinema",
    });
    const { itens } = await json(await chamar("GET", "/transactions", ANA));
    assert.equal(itens[0].conta.nome, "Conta principal");
  });

  test("conexões já existentes viram contas open_finance (sem a trava do plano) e levam os lançamentos importados", async () => {
    simularCategorizacao();
    const ligacao = await conexao("ana", 1800);
    const importada = await TransactionModel.create({
      userId: "ana",
      tipo: "despesa",
      valor: 20,
      categoria: "Outros",
      data: new Date("2026-10-02"),
      descricao: "Mercado",
      origem: "pluggy",
      externalId: "ext-1",
      contaConectadaId: String(ligacao._id),
    });

    const lista = await json(await chamar("GET", "/accounts", ANA));
    const aberta = lista.find((c: any) => c.tipo === "open_finance");
    assert.equal(aberta.nome, "Pluggy Bank");
    assert.equal(aberta.conectadaId, String(ligacao._id));
    assert.equal(aberta.saldoAtual, 1800);
    assert.equal((await TransactionModel.findById(importada._id).lean())?.contaId, aberta.id);
    assert.equal(lista.filter((c: any) => c.nome === "Conta principal").length, 0, "o importado não vai para a Conta principal");
  });

  test("conta Open Finance não se exclui (409 ACCOUNT_IS_OPEN_FINANCE); depois de desconectar ela vira manual e pode ser excluída", async () => {
    simularCategorizacao();
    const idPro = String((await UserModel.create({ nome: "Pro", email: "p2@teste.com", cpf: "33344455566", senhaHash: "x", plano: "pro" }))._id);
    const pro = tokenDe(idPro);
    const ligacao = await conexao(idPro);
    const aberta = (await json(await chamar("GET", "/accounts", pro))).find((c: any) => c.tipo === "open_finance");
    assert.ok(aberta);

    const recusada = await chamar("DELETE", `/accounts/${aberta.id}`, pro);
    assert.equal(recusada.status, 409);
    assert.equal((await json(recusada)).error.code, "ACCOUNT_IS_OPEN_FINANCE");
    assert.equal(await AccountModel.countDocuments({ _id: aberta.id }), 1);

    assert.equal((await chamar("DELETE", `/connected-accounts/${ligacao._id}`, pro)).status, 204);
    const manual = (await json(await chamar("GET", "/accounts", pro))).find((c: any) => c.id === aberta.id);
    assert.equal(manual.tipo, "manual");
    assert.equal((await chamar("DELETE", `/accounts/${aberta.id}`, pro)).status, 200);
  });

  test("lançamento de conta Open Finance não se exclui (422 OPEN_FINANCE_READ_ONLY)", async () => {
    simularCategorizacao();
    const idPro = String((await UserModel.create({ nome: "Pro", email: "p3@teste.com", cpf: "33344455577", senhaHash: "x", plano: "pro" }))._id);
    const pro = tokenDe(idPro);
    await conexao(idPro);
    const aberta = (await json(await chamar("GET", "/accounts", pro))).find((c: any) => c.tipo === "open_finance");
    const t = await TransactionModel.create({ userId: idPro, tipo: "despesa", valor: 10, categoria: "Outros", data: new Date("2026-10-02"), descricao: "Café", contaId: aberta.id });
    const resposta = await chamar("POST", "/transactions/bulk-delete", pro, { ids: [String(t._id)] });
    assert.equal(resposta.status, 422);
    assert.equal((await json(resposta)).error.code, "OPEN_FINANCE_READ_ONLY");
    assert.ok(await TransactionModel.findById(t._id).lean());
  });

  test("a despesa só sai do saldo quando a data chega; a compra no cartão, só quando a fatura vence", async () => {
    simularCategorizacao();
    await AccountModel.deleteMany({});
    await CardModel.deleteMany({});
    const conta = await AccountModel.create({ userId: "ana", nome: "Corrente", nomeChave: "corrente", banco: "bb", tipo: "manual", saldoInicial: 1000 });
    const contaId = String(conta._id);
    // fechamento no dia 15: a fatura que recebe a compra de hoje vence daqui a 7 a 38 dias, depois de hoje
    const cartao = await CardModel.create({ userId: "ana", nome: "Roxo", nomeChave: "roxo", limite: 5000, diaFechamento: 15, contaId });
    const hoje = new Date();
    const dia = (dias: number) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + dias));
    const base = { userId: "ana", tipo: "despesa", categoria: "Outros", descricao: "x", contaId };
    await TransactionModel.create({ ...base, valor: 100, data: dia(-1) }); // já chegou: sai
    await TransactionModel.create({ ...base, valor: 200, data: dia(5) }); // data futura: ainda não sai
    await TransactionModel.create({ ...base, valor: 300, data: dia(0), formaPagamento: "credito", cartaoId: String(cartao._id) }); // fatura ainda não venceu
    await TransactionModel.create({ ...base, valor: 400, data: dia(0), formaPagamento: "credito" }); // sem cartão gravado: vale o cartão da conta
    await TransactionModel.create({ ...base, valor: 500, data: dia(-120), formaPagamento: "credito", cartaoId: String(cartao._id) }); // fatura antiga já venceu
    const lista = await json(await chamar("GET", "/accounts", ANA));
    assert.equal(lista[0].saldoAtual, 400); // 1000 - 100 - 500
  });

  test("a 'Conta principal' reaproveita uma conta com esse nome que o usuário já criou", async () => {
    simularCategorizacao();
    await AccountModel.deleteMany({});
    await AccountModel.create({ userId: "ana", nome: "Conta Principal", nomeChave: "conta principal", banco: "bb", tipo: "manual", saldoInicial: 50 });
    await TransactionModel.create({ userId: "ana", tipo: "despesa", valor: 5, categoria: "Lazer", data: new Date(), descricao: "x" });
    const lista = await json(await chamar("GET", "/accounts", ANA));
    assert.equal(lista.length, 1);
    assert.equal(lista[0].saldoAtual, 45);
  });
});

test("rotas de contas exigem token válido", async () => {
  for (const [metodo, caminho] of [
    ["GET", "/accounts"],
    ["POST", "/accounts"],
    ["PATCH", `/accounts/${ID_INEXISTENTE}`],
    ["DELETE", `/accounts/${ID_INEXISTENTE}`],
  ]) {
    assert.equal((await chamarCru(metodo, caminho, "token-invalido", metodo === "GET" ? undefined : {})).status, 401, `${metodo} ${caminho}`);
  }
});

describe("ícone e cor da conta (aparência)", () => {
  test("cria com ícone e cor, e a listagem devolve os dois; sem eles, os campos nem aparecem", async () => {
    simularCategorizacao();
    const comAparencia = await json(await criarConta({ ...NOVA, icone: "cofrinho", cor: "verde" }));
    assert.equal(comAparencia.icone, "cofrinho");
    assert.equal(comAparencia.cor, "verde");
    const semAparencia = await json(await criarConta({ nome: "Outra", banco: "bb" }));
    assert.ok(!("icone" in semAparencia) && !("cor" in semAparencia));
    const lista = await json(await chamar("GET", "/accounts", ANA));
    assert.equal(lista.find((c: any) => c.nome === "Reserva").icone, "cofrinho");
  });

  test("ícone ou cor fora da lista: 400 e nada é salvo", async () => {
    simularCategorizacao();
    for (const extra of [{ icone: "foguete" }, { cor: "dourado" }, { icone: 3 }]) {
      assert.equal((await criarConta({ ...NOVA, ...extra })).status, 400, JSON.stringify(extra));
    }
    assert.equal(await AccountModel.countDocuments({ nome: "Reserva" }), 0);
  });

  test("PATCH muda o ícone e a cor; null volta ao padrão (o logo do banco)", async () => {
    simularCategorizacao();
    const { id } = await json(await criarConta({ ...NOVA, icone: "casa", cor: "azul" }));
    assert.equal((await chamar("PATCH", `/accounts/${id}`, ANA, { icone: "viagem-invalida" })).status, 400);
    const mudou = await json(await chamar("PATCH", `/accounts/${id}`, ANA, { icone: "mala", cor: "laranja" }));
    assert.equal(mudou.icone, "mala");
    assert.equal(mudou.cor, "laranja");
    const limpou = await json(await chamar("PATCH", `/accounts/${id}`, ANA, { icone: null, cor: null }));
    assert.ok(!("icone" in limpou) && !("cor" in limpou));
  });

  test("uma conta Open Finance aceita mudar só o ícone e a cor (nome e banco continuam do banco)", async () => {
    simularCategorizacao();
    const pro = await usuarioPro();
    const dono = JSON.parse(Buffer.from(pro.split(".")[1], "base64url").toString());
    const ligacao = await conexao(String(dono.sub ?? dono.id));
    const aberta = await json(await criarConta({ nome: "Pluggy", banco: "outro", tipo: "open_finance", conectadaId: String(ligacao._id) }, pro));
    assert.equal((await chamar("PATCH", `/accounts/${aberta.id}`, pro, { nome: "Outro nome" })).status, 422);
    const ok = await chamar("PATCH", `/accounts/${aberta.id}`, pro, { icone: "banco", cor: "roxo" });
    assert.equal(ok.status, 200);
    assert.equal((await json(ok)).icone, "banco");
  });
});
