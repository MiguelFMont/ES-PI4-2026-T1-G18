// src/modules/connected-accounts/__tests__/connected-accounts.routes.test.ts
// As rotas /v1/connected-accounts de ponta a ponta no Backend: app Express numa porta livre, MongoDB em memória,
// Pluggy simulada (com as transações reais do sandbox) e o Servidor Java de categorização simulado.
import "./ambiente";
import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../../http/app";
import { env } from "../../../config/env";
import { pluggyClient } from "../../../integrations/pluggy/pluggy.client";
import { TransactionModel } from "../../transactions/transactions.model";
import { ConnectedAccountModel } from "../connected-accounts.model";
import { encerrarBanco, iniciarBanco, limparBanco } from "./banco";
import { simularCategorizacao, simularPluggy } from "./apoio";

let servidor: Server;
let base: string;
let pluggy: ReturnType<typeof simularPluggy>;

const tokenDe = (id: string) => jwt.sign({ id, email: `${id}@teste.com` }, env.JWT_SECRET, { expiresIn: "1h" });
const ANA = tokenDe("ana");
const BETO = tokenDe("beto");

function chamar(metodo: string, caminho: string, token?: string, corpo?: unknown) {
  return fetch(`${base}/v1${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}
const json = (r: Response): Promise<any> => r.json();

async function conectarSandbox(token: string) {
  const resposta = await chamar("POST", "/connected-accounts/sandbox", token);
  return { resposta, corpo: await json(resposta) };
}
const todasAsTransacoes = async (token: string) => (await json(await chamar("GET", "/transactions?limite=100", token))).itens as any[];

before(async () => {
  await iniciarBanco();
  await TransactionModel.syncIndexes(); // o índice único (userId, externalId) é o que impede duplicar numa corrida
  await ConnectedAccountModel.syncIndexes();
  servidor = app.listen(0);
  await once(servidor, "listening");
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => servidor.close(resolve));
  await encerrarBanco();
});

beforeEach(async () => {
  await limparBanco();
  pluggyClient._limparCache();
  pluggy = simularPluggy();
  simularCategorizacao();
});
afterEach(() => mock.restoreAll());

describe("autenticação", () => {
  test("todas as rotas exigem token", async () => {
    for (const [metodo, caminho] of [["GET", "/connected-accounts"], ["POST", "/connected-accounts/sandbox"], ["POST", "/connected-accounts/connect-token"], ["POST", "/connected-accounts/507f1f77bcf86cd799439011/sync"], ["DELETE", "/connected-accounts/507f1f77bcf86cd799439011"]]) {
      assert.equal((await chamar(metodo, caminho)).status, 401, `${metodo} ${caminho}`);
    }
  });
});

describe("conectar o sandbox e importar", () => {
  test("cria a conta, importa as transações reais e as mostra na listagem com origem pluggy", async () => {
    const { resposta, corpo } = await conectarSandbox(ANA);
    assert.equal(resposta.status, 201);
    assert.equal(corpo.conta.instituicao, "Pluggy Bank");
    assert.equal(corpo.conta.status, "UPDATED");
    assert.deepEqual(corpo.conta.contas.map((c: any) => c.tipo).sort(), ["BANK", "CREDIT"]);

    const { lidas, importadas, ignoradas } = corpo.importacao;
    assert.equal(lidas, 48);
    assert.ok(importadas > 0);
    assert.ok(ignoradas.faturaCartao >= 1, "o pagamento da fatura do cartão não conta como gasto");
    const somaIgnoradas = Object.values<number>(ignoradas).reduce((a, b) => a + b, 0);
    assert.equal(importadas + somaIgnoradas, lidas, "tudo que foi lido foi importado ou ignorado com motivo");

    const lista = await todasAsTransacoes(ANA);
    assert.equal(lista.length, importadas);
    assert.ok(lista.every((t) => t.origem === "pluggy"));
    assert.ok(lista.every((t) => t.valor > 0));
    assert.ok(!lista.some((t) => /FATURA CARTAO/i.test(t.descricao)), "a fatura do cartão não foi importada");
  });

  test("cada transação nova é categorizada pelo Servidor Java", async () => {
    await conectarSandbox(ANA);
    const lista = await todasAsTransacoes(ANA);
    const categoriaDe = (descricao: string) => lista.find((t) => t.descricao === descricao)?.categoria;
    assert.equal(categoriaDe("SPOTIFY AB"), "Lazer");
    assert.equal(categoriaDe("CONDOMINIO EDIFICIO SOLAR"), "Moradia");
    assert.equal(categoriaDe("SALARIO EMPRESA XYZ LTDA"), "Salario");
  });

  test("despesa e receita seguem o sinal do amount, inclusive no cartão", async () => {
    await conectarSandbox(ANA);
    const lista = await todasAsTransacoes(ANA);
    const spotify = lista.find((t) => t.descricao === "SPOTIFY AB");
    const salario = lista.find((t) => t.descricao === "SALARIO EMPRESA XYZ LTDA");
    assert.equal(spotify.tipo, "despesa");
    assert.equal(spotify.formaPagamento, "credito");
    assert.equal(salario.tipo, "receita");
  });

  test("a resposta não expõe o id do item da Pluggy nem dados de terceiros", async () => {
    const { corpo } = await conectarSandbox(ANA);
    const texto = JSON.stringify(corpo) + JSON.stringify(await todasAsTransacoes(ANA));
    assert.doesNotMatch(texto, /pluggyItemId|externalId|paymentData|Francisco Souza|111\.111/);
  });

  test("o item da Pluggy é criado com o clientUserId do usuário", async () => {
    await conectarSandbox(ANA);
    assert.deepEqual([...pluggy.itens.values()].map((i) => i.item.clientUserId), ["ana"]);
  });

  test("sincronizar de novo não duplica nada", async () => {
    const { corpo } = await conectarSandbox(ANA);
    const resposta = await chamar("POST", `/connected-accounts/${corpo.conta.id}/sync`, ANA);
    assert.equal(resposta.status, 200);
    const segunda = await json(resposta);
    assert.equal(segunda.importadas, 0);
    assert.equal(segunda.ignoradas.duplicadas, corpo.importacao.importadas);
    assert.equal((await todasAsTransacoes(ANA)).length, corpo.importacao.importadas);
  });

  test("uma transação nova na Pluggy entra na próxima sincronização", async () => {
    const { corpo } = await conectarSandbox(ANA);
    const corrente = pluggy.fixture.contas.find((c) => c.type === "BANK")!;
    pluggy.adicionarTransacao(corrente.id, { id: "nova-1", description: "PADARIA NOVA", amount: -9.9, date: "2026-11-10T12:00:00.000Z", status: "POSTED" });
    pluggy.adicionarTransacao(corrente.id, { id: "nova-2", description: "AINDA PENDENTE", amount: -5, date: "2026-11-10T12:00:00.000Z", status: "PENDING" });

    const segunda = await json(await chamar("POST", `/connected-accounts/${corpo.conta.id}/sync`, ANA));
    assert.equal(segunda.importadas, 1);
    assert.equal(segunda.ignoradas.pendentes, 1);
    assert.ok((await todasAsTransacoes(ANA)).some((t) => t.descricao === "PADARIA NOVA"));
  });

  test("duas sincronizações ao mesmo tempo não duplicam (índice único userId + externalId)", async () => {
    // O item fica "em sincronização": a conexão registra a conta mas ainda não importa.
    const itemId = pluggy.criarItemExterno("ana");
    pluggy.segurarItem(itemId);
    const conectada = await json(await chamar("POST", "/connected-accounts", ANA, { itemId }));
    assert.equal(conectada.importacao, null);
    assert.equal(conectada.avisoImportacao.code, "PLUGGY_SYNC_IN_PROGRESS");

    pluggy.liberarItem(itemId);
    const [a, b] = await Promise.all([
      chamar("POST", `/connected-accounts/${conectada.conta.id}/sync`, ANA),
      chamar("POST", `/connected-accounts/${conectada.conta.id}/sync`, ANA),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const total = (await json(a)).importadas + (await json(b)).importadas;

    const lista = await todasAsTransacoes(ANA);
    assert.equal(lista.length, total, "o que cada resposta diz ter importado soma o que existe no banco");
    const ids = (await TransactionModel.find({ userId: "ana" }).lean()).map((t) => t.externalId);
    assert.equal(new Set(ids).size, ids.length, "nenhum externalId repetido");
  });

  test("com o Servidor Java fora do ar, importa mesmo assim com a categoria Outros", async () => {
    mock.restoreAll();
    pluggy = simularPluggy();
    simularCategorizacao({ indisponivel: true });
    const { resposta } = await conectarSandbox(ANA);
    assert.equal(resposta.status, 201);
    const lista = await todasAsTransacoes(ANA);
    assert.ok(lista.length > 0);
    assert.ok(lista.every((t) => t.categoria === "Outros"));
  });
});

describe("conectar um item criado pelo widget", () => {
  test("o connect token é pedido em nome do usuário", async () => {
    const resposta = await chamar("POST", "/connected-accounts/connect-token", ANA);
    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { accessToken: "token-simulado" });
  });

  test("registra o item do próprio usuário", async () => {
    const itemId = pluggy.criarItemExterno("ana");
    const resposta = await chamar("POST", "/connected-accounts", ANA, { itemId });
    assert.equal(resposta.status, 201);
    assert.ok((await json(resposta)).importacao.importadas > 0);
  });

  test("recusa o item de OUTRO usuário (403)", async () => {
    const itemDoBeto = pluggy.criarItemExterno("beto");
    const resposta = await chamar("POST", "/connected-accounts", ANA, { itemId: itemDoBeto });
    assert.equal(resposta.status, 403);
    assert.equal((await json(resposta)).error.code, "PLUGGY_ITEM_NOT_OWNED");
    assert.equal(await ConnectedAccountModel.countDocuments(), 0);
  });

  test("recusa um item sem dono (clientUserId vazio): não dá para provar de quem é", async () => {
    const itemSemDono = pluggy.criarItemExterno(null);
    assert.equal((await chamar("POST", "/connected-accounts", ANA, { itemId: itemSemDono })).status, 403);
  });

  test("o mesmo item não pode ser conectado duas vezes (409)", async () => {
    const itemId = pluggy.criarItemExterno("ana");
    assert.equal((await chamar("POST", "/connected-accounts", ANA, { itemId })).status, 201);
    const repetida = await chamar("POST", "/connected-accounts", ANA, { itemId });
    assert.equal(repetida.status, 409);
    assert.equal((await json(repetida)).error.code, "ACCOUNT_ALREADY_CONNECTED");
  });

  test("itemId inexistente na Pluggy: 404; itemId que não é UUID: 400", async () => {
    const inexistente = await chamar("POST", "/connected-accounts", ANA, { itemId: "11111111-1111-4111-8111-111111111111" });
    assert.equal(inexistente.status, 404);
    assert.equal((await chamar("POST", "/connected-accounts", ANA, { itemId: "abc" })).status, 400);
    assert.equal((await chamar("POST", "/connected-accounts", ANA, {})).status, 400);
  });
});

describe("listar e isolamento entre usuários", () => {
  test("cada usuário só vê as próprias contas", async () => {
    await conectarSandbox(ANA);
    await conectarSandbox(BETO);
    const daAna = await json(await chamar("GET", "/connected-accounts", ANA));
    const doBeto = await json(await chamar("GET", "/connected-accounts", BETO));
    assert.equal(daAna.length, 1);
    assert.equal(doBeto.length, 1);
    assert.notEqual(daAna[0].id, doBeto[0].id);
  });

  test("a mesma transação da Pluggy pode existir para dois usuários (o índice único é por usuário)", async () => {
    await conectarSandbox(ANA);
    await conectarSandbox(BETO);
    assert.equal((await todasAsTransacoes(ANA)).length, (await todasAsTransacoes(BETO)).length);
  });

  test("não dá para sincronizar nem desconectar a conta de outro usuário (404)", async () => {
    const { corpo } = await conectarSandbox(ANA);
    assert.equal((await chamar("POST", `/connected-accounts/${corpo.conta.id}/sync`, BETO)).status, 404);
    assert.equal((await chamar("DELETE", `/connected-accounts/${corpo.conta.id}`, BETO)).status, 404);
    assert.equal(await ConnectedAccountModel.countDocuments(), 1);
  });

  test("id mal formado: 400", async () => {
    assert.equal((await chamar("POST", "/connected-accounts/abc/sync", ANA)).status, 400);
    assert.equal((await chamar("DELETE", "/connected-accounts/abc", ANA)).status, 400);
  });
});

describe("desconectar", () => {
  test("remove a conta e o item da Pluggy, mas mantém as transações já importadas", async () => {
    const { corpo } = await conectarSandbox(ANA);
    const resposta = await chamar("DELETE", `/connected-accounts/${corpo.conta.id}`, ANA);
    assert.equal(resposta.status, 204);
    assert.equal((await json(await chamar("GET", "/connected-accounts", ANA))).length, 0);
    assert.equal(pluggy.itens.size, 0, "o item foi apagado na Pluggy");
    assert.equal((await todasAsTransacoes(ANA)).length, corpo.importacao.importadas);
    assert.equal((await chamar("DELETE", `/connected-accounts/${corpo.conta.id}`, ANA)).status, 404);
  });

  test("se o item já não existe na Pluggy, desconecta mesmo assim", async () => {
    const { corpo } = await conectarSandbox(ANA);
    pluggy.itens.clear();
    assert.equal((await chamar("DELETE", `/connected-accounts/${corpo.conta.id}`, ANA)).status, 204);
  });

  test("se a Pluggy estiver fora do ar, o usuário ainda consegue desconectar", async () => {
    const { corpo } = await conectarSandbox(ANA);
    pluggy.derrubarRede();
    assert.equal((await chamar("DELETE", `/connected-accounts/${corpo.conta.id}`, ANA)).status, 204);
    assert.equal(await ConnectedAccountModel.countDocuments(), 0);
  });
});

describe("limites e falhas", () => {
  test("no máximo 5 contas por usuário (422) e sem criar item na Pluggy quando passa do limite", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await conectarSandbox(ANA)).resposta.status, 201);
    const itensAntes = pluggy.itens.size;
    const sexta = await conectarSandbox(ANA);
    assert.equal(sexta.resposta.status, 422);
    assert.equal(sexta.corpo.error.code, "ACCOUNT_LIMIT_REACHED");
    assert.equal(pluggy.itens.size, itensAntes);
  });

  test("Pluggy fora do ar: 503 PLUGGY_UNAVAILABLE", async () => {
    pluggy.derrubarRede();
    const { resposta, corpo } = await conectarSandbox(ANA);
    assert.equal(resposta.status, 503);
    assert.equal(corpo.error.code, "PLUGGY_UNAVAILABLE");
  });

  test("Pluggy sem credenciais configuradas: 503 PLUGGY_NOT_CONFIGURED", async () => {
    const [id, segredo] = [env.PLUGGY_CLIENT_ID, env.PLUGGY_CLIENT_SECRET];
    env.PLUGGY_CLIENT_ID = undefined;
    env.PLUGGY_CLIENT_SECRET = undefined;
    try {
      const { resposta, corpo } = await conectarSandbox(ANA);
      assert.equal(resposta.status, 503);
      assert.equal(corpo.error.code, "PLUGGY_NOT_CONFIGURED");
    } finally {
      env.PLUGGY_CLIENT_ID = id;
      env.PLUGGY_CLIENT_SECRET = segredo;
    }
  });

  test("falha depois de criar o item: não deixa item órfão na Pluggy", async () => {
    pluggy.falharEm(/GET \/accounts/, 503);
    const { resposta } = await conectarSandbox(ANA);
    assert.equal(resposta.status, 502);
    assert.equal(pluggy.itens.size, 0, "o item criado foi apagado");
    assert.equal(await ConnectedAccountModel.countDocuments(), 0);
  });

  test("conexão com erro de login na instituição: 422 PLUGGY_ITEM_ERROR e o status fica salvo", async () => {
    const itemId = pluggy.criarItemExterno("ana");
    const conectada = await json(await chamar("POST", "/connected-accounts", ANA, { itemId }));
    pluggy.liberarItem(itemId, "LOGIN_ERROR");
    pluggy.itens.get(itemId)!.consultas = 5;

    const resposta = await chamar("POST", `/connected-accounts/${conectada.conta.id}/sync`, ANA);
    assert.equal(resposta.status, 422);
    assert.equal((await json(resposta)).error.code, "PLUGGY_ITEM_ERROR");
    const [conta] = await json(await chamar("GET", "/connected-accounts", ANA));
    assert.equal(conta.status, "LOGIN_ERROR");
  });
});
