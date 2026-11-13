// src/modules/connected-accounts/__tests__/pluggy.client.test.ts
// O cliente da Pluggy com a API simulada: apiKey em cache e renovada, paginação por cursor, espera do item e tradução de erros.
import "./ambiente";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../../../config/env";
import { pluggyClient } from "../../../integrations/pluggy/pluggy.client";
import { AppError } from "../../../shared/errors/app-error";
import { simularPluggy } from "./apoio";

let pluggy: ReturnType<typeof simularPluggy>;

beforeEach(() => {
  pluggyClient._limparCache();
  pluggy = simularPluggy();
});
afterEach(() => mock.restoreAll());

const falhaCom = (code: string, status: number) => (erro: unknown) =>
  erro instanceof AppError && erro.code === code && erro.statusCode === status;

describe("autenticação", () => {
  test("a apiKey é pedida uma vez e reaproveitada nas chamadas seguintes", async () => {
    await pluggyClient.listarContas("item-1");
    await pluggyClient.listarContas("item-1");
    assert.equal(pluggy.autenticacoes(), 1);
  });

  test("se a Pluggy responder 401, autentica de novo e repete a chamada", async () => {
    await pluggyClient.listarContas("item-1");
    pluggy.expirarChave();
    const contas = await pluggyClient.listarContas("item-1");
    assert.equal(pluggy.autenticacoes(), 2);
    assert.equal(contas.length, 2);
  });

  test("as credenciais só aparecem na chamada de /auth (nunca nas demais)", async () => {
    await pluggyClient.listarContas("item-1");
    const outras = pluggy.chamadas.filter((c) => c.caminho !== "/auth");
    for (const c of outras) assert.doesNotMatch(c.caminho, new RegExp(env.PLUGGY_CLIENT_SECRET ?? "x"));
  });

  test("sem PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET: 503 PLUGGY_NOT_CONFIGURED, sem chamar a rede", async () => {
    const [id, segredo] = [env.PLUGGY_CLIENT_ID, env.PLUGGY_CLIENT_SECRET];
    env.PLUGGY_CLIENT_ID = undefined;
    env.PLUGGY_CLIENT_SECRET = undefined;
    try {
      await assert.rejects(pluggyClient.listarContas("item-1"), falhaCom("PLUGGY_NOT_CONFIGURED", 503));
      assert.equal(pluggy.chamadas.length, 0);
    } finally {
      env.PLUGGY_CLIENT_ID = id;
      env.PLUGGY_CLIENT_SECRET = segredo;
    }
  });

  test("credenciais recusadas pela Pluggy: 502 PLUGGY_AUTH_FAILED", async () => {
    pluggy.falharEm(/POST \/auth/, 401);
    await assert.rejects(pluggyClient.listarContas("item-1"), falhaCom("PLUGGY_AUTH_FAILED", 502));
  });
});

describe("tradução de erros", () => {
  test("rede fora do ar: 503 PLUGGY_UNAVAILABLE", async () => {
    pluggy.derrubarRede();
    await assert.rejects(pluggyClient.listarContas("item-1"), falhaCom("PLUGGY_UNAVAILABLE", 503));
  });

  test("404 da Pluggy: 404 PLUGGY_NOT_FOUND", async () => {
    await assert.rejects(pluggyClient.obterItem("nao-existe"), falhaCom("PLUGGY_NOT_FOUND", 404));
  });

  test("outro 4xx (pedido recusado): 422 PLUGGY_REJECTED", async () => {
    pluggy.falharEm(/POST \/items/, 400);
    await assert.rejects(pluggyClient.criarItem(2, { user: "x", password: "y" }, "u1"), falhaCom("PLUGGY_REJECTED", 422));
  });

  test("5xx da Pluggy: 502 PLUGGY_ERROR", async () => {
    pluggy.falharEm(/GET \/accounts/, 503);
    await assert.rejects(pluggyClient.listarContas("item-1"), falhaCom("PLUGGY_ERROR", 502));
  });
});

describe("itens e transações", () => {
  test("criar item grava o clientUserId do usuário", async () => {
    const item = await pluggyClient.criarItem(2, { user: "user-ok", password: "password-ok" }, "ana");
    assert.equal(item.clientUserId, "ana");
  });

  test("esperarItem consulta até o item sair de UPDATING", async () => {
    const item = await pluggyClient.criarItem(2, { user: "user-ok", password: "password-ok" }, "ana");
    const pronto = await pluggyClient.esperarItem(item.id);
    assert.equal(pronto.status, "UPDATED");
    assert.ok(pluggy.chamadas.filter((c) => c.caminho === `/items/${item.id}`).length >= 2);
  });

  test("esperarItem desiste depois do tempo máximo e devolve o item ainda em andamento", async () => {
    const item = await pluggyClient.criarItem(2, { user: "user-ok", password: "password-ok" }, "ana");
    pluggy.segurarItem(item.id);
    const resultado = await pluggyClient.esperarItem(item.id);
    assert.equal(resultado.status, "UPDATING");
  });

  test("listarTransacoes segue o cursor (next) até a última página", async () => {
    const corrente = pluggy.fixture.contas.find((c) => c.type === "BANK")!;
    const transacoes = await pluggyClient.listarTransacoes(corrente.id);
    assert.equal(transacoes.length, corrente.transacoes.length);
    assert.ok(corrente.transacoes.length > 20, "a fixture precisa de mais de uma página para este teste valer");
    const paginas = pluggy.chamadas.filter((c) => c.caminho.startsWith("/v2/transactions"));
    assert.ok(paginas.length >= 2);
    assert.equal(new Set(transacoes.map((t) => t.id)).size, transacoes.length, "sem repetir transações entre páginas");
  });

  test("usa o endpoint v2 (o GET /transactions antigo foi descontinuado)", async () => {
    await pluggyClient.listarTransacoes(pluggy.fixture.contas[0].id);
    assert.ok(pluggy.chamadas.every((c) => !/^\/transactions/.test(c.caminho)));
  });

  test("criar o connect token devolve o accessToken", async () => {
    assert.deepEqual(await pluggyClient.criarConnectToken("ana"), { accessToken: "token-simulado" });
  });
});
