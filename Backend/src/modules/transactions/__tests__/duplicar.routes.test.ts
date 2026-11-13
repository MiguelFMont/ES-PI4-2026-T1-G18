// src/modules/transactions/__tests__/duplicar.routes.test.ts
// POST /v1/transactions/:id/duplicate de ponta a ponta no Backend (issue #49): app Express numa porta livre e banco isolado.
// Reaproveita o ambiente e o banco de teste de contas conectadas (variáveis falsas; TESTE_MONGO_URI opcional).
import "../../connected-accounts/__tests__/ambiente";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../../http/app";
import { env } from "../../../config/env";
import { TransactionModel } from "../transactions.model";
import { encerrarBanco, iniciarBanco, limparBanco } from "../../connected-accounts/__tests__/banco";

let servidor: Server;
let base: string;

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

const ORIGINAL = {
  tipo: "despesa",
  valor: 59.9,
  categoria: "Lazer",
  data: "2026-10-05T00:00:00.000Z",
  descricao: "Netflix",
  observacoes: "plano família",
  formaPagamento: "credito",
};

async function criarManual(token = ANA, dados: Record<string, unknown> = ORIGINAL) {
  return json(await chamar("POST", "/transactions", token, dados));
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

beforeEach(limparBanco);

describe("POST /v1/transactions/:id/duplicate", () => {
  test("cria uma transação nova com os mesmos dados, menos o id e a data (que vira a de agora)", async () => {
    const original = await criarManual();
    const antes = Date.now();
    const resposta = await chamar("POST", `/transactions/${original.id}/duplicate`, ANA);
    const copia = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.notEqual(copia.id, original.id);
    for (const campo of ["tipo", "valor", "categoria", "descricao", "observacoes", "formaPagamento"]) {
      assert.equal(copia[campo], original[campo], campo);
    }
    assert.equal(copia.origem, "manual");
    assert.ok(Date.parse(copia.data) >= antes - 1000, "a data é a de agora");
    assert.notEqual(copia.data, original.data);
  });

  test("aceita a data do novo lançamento no corpo", async () => {
    const original = await criarManual();
    const copia = await json(await chamar("POST", `/transactions/${original.id}/duplicate`, ANA, { data: "2026-12-05" }));
    assert.equal(copia.data, "2026-12-05T00:00:00.000Z");
  });

  test("o original não é alterado e a lista passa a ter as duas", async () => {
    const original = await criarManual();
    await chamar("POST", `/transactions/${original.id}/duplicate`, ANA);
    const lista = await json(await chamar("GET", "/transactions", ANA));
    assert.equal(lista.total, 2);
    assert.deepEqual(lista.itens.find((t: any) => t.id === original.id), original);
  });

  test("copia a transação sem observação sem inventar o campo", async () => {
    const { observacoes: _o, ...semObs } = ORIGINAL;
    const original = await criarManual(ANA, semObs);
    const copia = await json(await chamar("POST", `/transactions/${original.id}/duplicate`, ANA));
    assert.ok(!("observacoes" in copia));
  });

  test("lançamento importado da Pluggy não duplica (422 DUPLICATE_NOT_ALLOWED)", async () => {
    const importada = await TransactionModel.create({
      ...ORIGINAL, data: new Date(ORIGINAL.data), origem: "pluggy", externalId: "ext-1", userId: "ana",
    });
    const resposta = await chamar("POST", `/transactions/${importada._id}/duplicate`, ANA);
    assert.equal(resposta.status, 422);
    assert.equal((await json(resposta)).error.code, "DUPLICATE_NOT_ALLOWED");
    assert.equal(await TransactionModel.countDocuments(), 1);
  });

  test("transação de outro usuário ou inexistente: 404, sem criar nada", async () => {
    const daAna = await criarManual(ANA);
    const outroUsuario = await chamar("POST", `/transactions/${daAna.id}/duplicate`, BETO);
    assert.equal(outroUsuario.status, 404);
    const inexistente = await chamar("POST", `/transactions/${"a".repeat(24)}/duplicate`, ANA);
    assert.equal(inexistente.status, 404);
    assert.equal(await TransactionModel.countDocuments(), 1);
  });

  test("id inválido ou data inválida: 400 VALIDATION_ERROR", async () => {
    const original = await criarManual();
    const idRuim = await chamar("POST", "/transactions/abc/duplicate", ANA);
    assert.equal(idRuim.status, 400);
    assert.equal((await json(idRuim)).error.code, "VALIDATION_ERROR");
    const dataRuim = await chamar("POST", `/transactions/${original.id}/duplicate`, ANA, { data: "ontem" });
    assert.equal(dataRuim.status, 400);
  });

  test("sem token: 401", async () => {
    const resposta = await chamar("POST", `/transactions/${"a".repeat(24)}/duplicate`);
    assert.equal(resposta.status, 401);
  });
});
