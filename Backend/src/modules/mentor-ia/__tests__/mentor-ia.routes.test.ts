// src/modules/mentor-ia/__tests__/mentor-ia.routes.test.ts
// As rotas /v1/mentor-ia/chat de ponta a ponta no Backend: app Express numa porta livre, MongoDB
// em memória, e a API de IA e o Servidor Java simulados.
import "./ambiente";
import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../../http/app";
import { env } from "../../../config/env";
import { ChatMessageModel } from "../mentor-ia.model";
import { TransactionModel } from "../../transactions/transactions.model";
import { AppError } from "../../../shared/errors/app-error";
import { encerrarBanco, iniciarBanco, limparBanco } from "./banco-de-teste";
import { respostaDaIa, simularApiDeIa, simularServidorJava } from "./apoio";

let servidor: Server;
let base: string;

const tokenDe = (id: string) => jwt.sign({ id, email: `${id}@teste.com` }, env.JWT_SECRET, { expiresIn: "1h" });
const ANA = tokenDe("ana");
const BETO = tokenDe("beto");

function chat(metodo: "GET" | "POST", token?: string, corpo?: unknown) {
  return fetch(`${base}/v1/mentor-ia/chat`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

// corpo da resposta já como `any`, para ler os campos nos asserts
const json = (resposta: Response): Promise<any> => resposta.json();

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
afterEach(() => mock.restoreAll());

describe("POST /v1/mentor-ia/chat", () => {
  test("sem token ou com token inválido: 401 UNAUTHENTICATED", async () => {
    const pedidos = simularServidorJava();

    for (const token of [undefined, "token-invalido", jwt.sign({ id: "ana" }, "outro-segredo")]) {
      const resposta = await chat("POST", token, { texto: "Oi" });
      assert.equal(resposta.status, 401);
      assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    }
    assert.equal(pedidos.length, 0);
  });

  test("texto ausente, vazio, só espaços ou com mais de 2000 caracteres: 400 VALIDATION_ERROR", async () => {
    const pedidos = simularServidorJava();
    const chamadas = simularApiDeIa(() => respostaDaIa("ok"));

    for (const corpo of [{}, { texto: "" }, { texto: "   " }, { texto: 123 }, { texto: "a".repeat(2001) }]) {
      const resposta = await chat("POST", ANA, corpo);
      assert.equal(resposta.status, 400, JSON.stringify(corpo));
      assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    }
    assert.equal(pedidos.length, 0);
    assert.equal(chamadas.length, 0);
    assert.equal(await ChatMessageModel.countDocuments(), 0);
  });

  test("pergunta e resposta: 200, salva as duas e usa só as transações do mês do próprio usuário", async () => {
    const agora = new Date();
    await TransactionModel.create([
      { userId: "ana", tipo: "despesa", valor: 1400, categoria: "Moradia", descricao: "Aluguel", data: agora },
      { userId: "beto", tipo: "despesa", valor: 99, categoria: "Lazer", descricao: "Cinema", data: agora },
    ]);
    const pedidos = simularServidorJava({ contexto: "Mês atual: despesas R$ 1.400,00." });
    const chamadas = simularApiDeIa(() => respostaDaIa("Sua maior despesa é **Moradia**."));

    // espaços nas pontas são removidos; 2000 caracteres é o limite aceito
    const resposta = await chat("POST", ANA, { texto: "  Qual categoria pesa mais?  " });
    assert.equal(resposta.status, 200);
    const corpo = await json(resposta);

    assert.equal(corpo.pergunta.autor, "usuario");
    assert.equal(corpo.pergunta.texto, "Qual categoria pesa mais?");
    assert.equal(corpo.resposta.autor, "ia");
    assert.equal(corpo.resposta.texto, "Sua maior despesa é **Moradia**.");
    for (const m of [corpo.pergunta, corpo.resposta]) {
      assert.deepEqual(Object.keys(m).sort(), ["autor", "criadaEm", "id", "texto"]);
      assert.ok(!Number.isNaN(Date.parse(m.criadaEm)));
    }

    // o Java recebeu só a transação da Ana; a IA, o contexto devolvido pelo Java
    assert.deepEqual(
      pedidos[0].dados.transacoes.map((t: { descricao: string }) => t.descricao),
      ["Aluguel"]
    );
    assert.match(chamadas[0].corpo.messages[0].content, /despesas R\$ 1\.400,00/);

    const salvas = await ChatMessageModel.find({ userId: "ana" }).lean();
    assert.equal(salvas.length, 2);

    const limite = await chat("POST", ANA, { texto: "a".repeat(2000) });
    assert.equal(limite.status, 200);
  });

  test("recomendação de ativo da IA: o usuário recebe e o histórico guarda a resposta filtrada", async () => {
    const aviso = "Não posso recomendar a compra ou a venda de ativos específicos.";
    simularServidorJava({ filtrar: (r) => (r.includes("PETR4") ? aviso : r) });
    simularApiDeIa(() => respostaDaIa("Compre PETR4 agora."));

    const resposta = await chat("POST", ANA, { texto: "Devo comprar PETR4?" });
    assert.equal(resposta.status, 200);
    assert.equal((await json(resposta)).resposta.texto, aviso);

    const daIa = await ChatMessageModel.findOne({ userId: "ana", autor: "ia" }).lean();
    assert.equal(daIa?.texto, aviso);
    assert.equal(await ChatMessageModel.countDocuments({ texto: /Compre PETR4/ }), 0);
  });

  test("erros da IA e do Servidor Java viram o status do contrato e nada é salvo", async () => {
    mock.method(console, "error", () => {});
    const casos: { preparar: () => void; status: number; code: string }[] = [
      { preparar: () => simularApiDeIa(() => new Response("", { status: 429 })), status: 429, code: "GENAI_RATE_LIMITED" },
      { preparar: () => simularApiDeIa(() => new Response("", { status: 500 })), status: 502, code: "GENAI_ERROR" },
      { preparar: () => simularApiDeIa(() => Promise.reject(new TypeError("fetch failed"))), status: 503, code: "GENAI_UNAVAILABLE" },
    ];
    for (const caso of casos) {
      simularServidorJava();
      caso.preparar();
      const resposta = await chat("POST", ANA, { texto: "Oi" });
      assert.equal(resposta.status, caso.status, caso.code);
      assert.equal((await json(resposta)).error.code, caso.code);
      mock.restoreAll();
      mock.method(console, "error", () => {});
    }

    simularServidorJava({
      falhar: { tipo: "PedidoMontarContextoIA", erro: new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE") },
    });
    const resposta = await chat("POST", ANA, { texto: "Oi" });
    assert.equal(resposta.status, 503);
    assert.equal((await json(resposta)).error.code, "JAVA_SERVER_UNAVAILABLE");

    assert.equal(await ChatMessageModel.countDocuments(), 0);
  });
});

describe("GET /v1/mentor-ia/chat", () => {
  test("sem token: 401 UNAUTHENTICATED", async () => {
    const resposta = await chat("GET");
    assert.equal(resposta.status, 401);
    assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
  });

  test("sem conversa: 200 []", async () => {
    const resposta = await chat("GET", ANA);
    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), []);
  });

  test("devolve só o histórico do dono do token, da mais antiga para a mais nova", async () => {
    simularServidorJava();
    simularApiDeIa(({ corpo }) => respostaDaIa(`resposta para: ${corpo.messages.at(-1)!.content}`));

    await chat("POST", ANA, { texto: "pergunta da Ana 1" });
    await chat("POST", BETO, { texto: "pergunta do Beto" });
    await chat("POST", ANA, { texto: "pergunta da Ana 2" });

    const daAna = await json(await chat("GET", ANA));
    assert.deepEqual(
      daAna.map((m: { autor: string; texto: string }) => `${m.autor}: ${m.texto}`),
      [
        "usuario: pergunta da Ana 1",
        "ia: resposta para: pergunta da Ana 1",
        "usuario: pergunta da Ana 2",
        "ia: resposta para: pergunta da Ana 2",
      ]
    );

    const doBeto = await json(await chat("GET", BETO));
    assert.deepEqual(
      doBeto.map((m: { texto: string }) => m.texto),
      ["pergunta do Beto", "resposta para: pergunta do Beto"]
    );
  });
});
