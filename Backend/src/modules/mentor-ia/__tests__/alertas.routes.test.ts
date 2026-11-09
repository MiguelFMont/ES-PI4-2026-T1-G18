// src/modules/mentor-ia/__tests__/alertas.routes.test.ts
// As rotas /v1/mentor-ia/alerts de ponta a ponta no Backend: app Express numa porta livre e MongoDB em
// memória. Os alertas são gerados na leitura com o relógio do servidor (new Date()), então o Date é
// fixado com mock.timers em 09/11/2026 12:30 de Brasília (só o Date: os timers continuam reais).
import "./ambiente";
import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../../http/app";
import { env } from "../../../config/env";
import { AlertModel } from "../mentor-ia.model";
import { TransactionModel } from "../../transactions/transactions.model";
import { encerrarBanco, iniciarBanco, limparBanco } from "./banco-de-teste";
import { seedEm } from "./seed";

let servidor: Server;
let base: string;

const AGORA = new Date("2026-11-09T12:30:00-03:00");

// O token é assinado na hora do pedido, com o Date já fixado, para o `exp` valer no relógio simulado.
const tokenDe = (id: string) => jwt.sign({ id, email: `${id}@teste.com` }, env.JWT_SECRET, { expiresIn: "1h" });

function pedir(metodo: "GET" | "PATCH", caminho: string, usuario?: string) {
  return fetch(`${base}/v1/mentor-ia${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(usuario && { Authorization: `Bearer ${tokenDe(usuario)}` }) },
  });
}
const listar = (usuario?: string) => pedir("GET", "/alerts", usuario);
const marcarLido = (id: string, usuario?: string) => pedir("PATCH", `/alerts/${id}/lido`, usuario);

// corpo da resposta já como `any`, para ler os campos nos asserts
const json = (resposta: Response): Promise<any> => resposta.json();
const tiposDe = (alertas: { tipo: string }[]) => alertas.map((a) => a.tipo).sort();

// Seed do usuário + uma despesa de R$ 1.500 em Alimentacao hoje (o exemplo da seção 3.5 do contrato).
// Devolve o _id dessa despesa.
async function popular(userId: string) {
  await TransactionModel.insertMany(seedEm(AGORA).map((t) => ({ ...t, userId })));
  const gasto = await TransactionModel.create({
    userId,
    tipo: "despesa",
    valor: 1500,
    categoria: "Alimentacao",
    descricao: "Jantar de aniversário",
    formaPagamento: "debito",
    data: AGORA,
  });
  return gasto._id;
}

before(async () => {
  await iniciarBanco();
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
  mock.timers.enable({ apis: ["Date"], now: AGORA });
});
afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

describe("GET /v1/mentor-ia/alerts", () => {
  test("sem token ou com token inválido: 401 UNAUTHENTICATED", async () => {
    const semToken = await listar();
    assert.equal(semToken.status, 401);
    assert.equal((await json(semToken)).error.code, "UNAUTHENTICATED");

    const invalido = await fetch(`${base}/v1/mentor-ia/alerts`, { headers: { Authorization: "Bearer token-invalido" } });
    assert.equal(invalido.status, 401);
    assert.equal(await AlertModel.countDocuments(), 0);
  });

  test("seed + gasto acima do padrão: o alerta aparece na listagem, com os campos do contrato", async () => {
    await popular("ana");

    const resposta = await listar("ana");
    assert.equal(resposta.status, 200);
    const alertas = await json(resposta);

    // 09/11: gasto fora do padrão (R$ 1.500), fatura do dia 10 e a sobra de salário do seed
    assert.deepEqual(tiposDe(alertas), ["dinheiro_parado", "fatura_proxima", "gasto_fora_do_padrao"]);
    for (const a of alertas) {
      assert.deepEqual(Object.keys(a).sort(), ["criadaEm", "dados", "id", "lido", "mensagem", "tipo", "titulo"]);
      assert.match(a.id, /^[0-9a-f]{24}$/);
      assert.equal(a.lido, false);
      assert.equal(a.criadaEm, AGORA.toISOString());
    }

    const gasto = alertas.find((a: { tipo: string }) => a.tipo === "gasto_fora_do_padrao");
    // os mesmos números do exemplo da seção 3.6 do contrato (capturado com o seed em 09/11/2026)
    assert.equal(gasto.titulo, "Gasto fora do padrão em Alimentacao");
    assert.equal(
      gasto.mensagem,
      "Em novembro você já gastou R$ 2.070,85 com Alimentacao, 3,2 vezes o maior gasto mensal dessa categoria " +
        "nos últimos 3 meses (R$ 647,40)."
    );
    assert.deepEqual(gasto.dados, { categoria: "Alimentacao", valorAtual: 2070.85, maiorMesAnterior: 647.4, mediaMensal: 400.55 });
  });

  test("só o seed: nenhum gasto_fora_do_padrao (nenhum falso-positivo)", async () => {
    await TransactionModel.insertMany(seedEm(AGORA).map((t) => ({ ...t, userId: "ana" })));

    const alertas = await json(await listar("ana"));
    assert.deepEqual(tiposDe(alertas), ["dinheiro_parado", "fatura_proxima"]);
  });

  test("ler duas vezes não duplica os alertas", async () => {
    await popular("ana");

    const primeira = await json(await listar("ana"));
    const segunda = await json(await listar("ana"));

    assert.equal(segunda.length, 3);
    assert.deepEqual(segunda.map((a: { id: string }) => a.id).sort(), primeira.map((a: { id: string }) => a.id).sort());
    assert.equal(await AlertModel.countDocuments({ userId: "ana" }), 3);
  });

  test("cada usuário vê só os próprios alertas", async () => {
    await popular("ana");
    await listar("ana");

    const resposta = await listar("beto");
    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), []);
    assert.equal(await AlertModel.countDocuments({ userId: "beto" }), 0);
  });

  test("alerta não lido cuja condição deixou de valer some na leitura seguinte", async () => {
    const gastoId = await popular("ana");
    assert.ok(tiposDe(await json(await listar("ana"))).includes("gasto_fora_do_padrao"));

    // o usuário excluiu o gasto que gerou o alerta
    await TransactionModel.deleteOne({ _id: gastoId });
    assert.deepEqual(tiposDe(await json(await listar("ana"))), ["dinheiro_parado", "fatura_proxima"]);
    assert.equal(await AlertModel.countDocuments({ userId: "ana", tipo: "gasto_fora_do_padrao" }), 0);

    // e o período passou: em 11/11 a fatura do dia 10 já venceu
    mock.timers.setTime(new Date("2026-11-11T12:30:00-03:00").getTime());
    assert.deepEqual(tiposDe(await json(await listar("ana"))), ["dinheiro_parado"]);
  });
});

describe("PATCH /v1/mentor-ia/alerts/:id/lido", () => {
  test("sem token: 401 UNAUTHENTICATED", async () => {
    const resposta = await marcarLido("6af1bbb52676e89cd05622c2");
    assert.equal(resposta.status, 401);
    assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
  });

  test("marca como lido: 200 com lido true, e o alerta sai da listagem sem voltar", async () => {
    await popular("ana");
    const gasto = (await json(await listar("ana"))).find((a: { tipo: string }) => a.tipo === "gasto_fora_do_padrao");

    const resposta = await marcarLido(gasto.id, "ana");
    assert.equal(resposta.status, 200);
    const lido = await json(resposta);
    assert.equal(lido.id, gasto.id);
    assert.equal(lido.lido, true);
    assert.equal(lido.mensagem, gasto.mensagem);

    // a condição continua valendo, mas o alerta lido não é listado de novo nem recriado
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(tiposDe(await json(await listar("ana"))), ["dinheiro_parado", "fatura_proxima"]);
    }
    assert.equal(await AlertModel.countDocuments({ userId: "ana", tipo: "gasto_fora_do_padrao" }), 1);
  });

  test("alerta lido fica como histórico mesmo quando a condição deixa de valer, e não volta no mesmo mês", async () => {
    const gastoId = await popular("ana");
    const gasto = (await json(await listar("ana"))).find((a: { tipo: string }) => a.tipo === "gasto_fora_do_padrao");
    await marcarLido(gasto.id, "ana");

    await TransactionModel.deleteOne({ _id: gastoId });
    await listar("ana");
    const guardado = await AlertModel.findById(gasto.id).lean();
    assert.equal(guardado?.lido, true);

    // um novo gasto alto no mesmo mês: mesma chave, continua lido
    await TransactionModel.create({
      userId: "ana", tipo: "despesa", valor: 2000, categoria: "Alimentacao", descricao: "Festa", formaPagamento: "pix", data: AGORA,
    });
    const alertas = await json(await listar("ana"));
    assert.ok(!tiposDe(alertas).includes("gasto_fora_do_padrao"));
    assert.equal(await AlertModel.countDocuments({ userId: "ana", tipo: "gasto_fora_do_padrao" }), 1);
  });

  test("id malformado: 400 VALIDATION_ERROR", async () => {
    for (const id of ["123", "nao-e-um-id", "6af1bbb52676e89cd05622cz"]) {
      const resposta = await marcarLido(id, "ana");
      assert.equal(resposta.status, 400, id);
      assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    }
  });

  test("alerta de outro usuário ou inexistente: 404 ALERT_NOT_FOUND, sem mudar nada", async () => {
    await popular("ana");
    const [alerta] = await json(await listar("ana"));

    for (const id of [alerta.id, "6af1bbb52676e89cd05622c2"]) {
      const resposta = await marcarLido(id, "beto");
      assert.equal(resposta.status, 404, id);
      assert.equal((await json(resposta)).error.code, "ALERT_NOT_FOUND");
    }
    assert.equal((await AlertModel.findById(alerta.id).lean())?.lido, false);
    assert.equal((await json(await listar("ana"))).length, 3);
  });
});
