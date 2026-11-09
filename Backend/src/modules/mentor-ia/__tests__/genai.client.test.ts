// src/modules/mentor-ia/__tests__/genai.client.test.ts
import "./ambiente";
import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { chamarApiDeIaGenerativa } from "../genai.client";
import { env } from "../../../config/env";
import { respostaDaIa, simularApiDeIa } from "./apoio";

afterEach(() => mock.restoreAll());

describe("genai.client (chamarApiDeIaGenerativa)", () => {
  test("monta a requisição com instruções, contexto, histórico e pergunta", async () => {
    const chamadas = simularApiDeIa(() => respostaDaIa("  Resposta do mentor.  "));

    const resposta = await chamarApiDeIaGenerativa("Mês atual: despesas R$ 1.400,00.", "Como reduzir gastos?", [
      { autor: "usuario", texto: "Oi" },
      { autor: "ia", texto: "Olá! Como posso ajudar?" },
    ]);

    assert.equal(resposta, "Resposta do mentor."); // sem espaços nas pontas
    assert.equal(chamadas.length, 1);
    const { url, init, corpo } = chamadas[0];
    assert.equal(url, "http://genai.teste/v1/chat/completions");
    assert.equal(init.method, "POST");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer chave-de-teste");
    assert.equal(corpo.model, "modelo-de-teste");

    const [sistema, ...resto] = corpo.messages;
    assert.equal(sistema.role, "system");
    assert.match(sistema.content, /Resumo financeiro do usuário: Mês atual: despesas R\$ 1\.400,00\./);
    assert.match(sistema.content, /Nunca recomende comprar, vender ou aportar em um ativo específico/);
    assert.deepEqual(resto, [
      { role: "user", content: "Oi" },
      { role: "assistant", content: "Olá! Como posso ajudar?" },
      { role: "user", content: "Como reduzir gastos?" },
    ]);
  });

  test("sem histórico, manda só as instruções e a pergunta", async () => {
    const chamadas = simularApiDeIa(() => respostaDaIa("ok"));
    await chamarApiDeIaGenerativa("contexto", "pergunta");
    assert.deepEqual(
      chamadas[0].corpo.messages.map((m) => m.role),
      ["system", "user"]
    );
  });

  test("sem GENAI_API_KEY: 503 GENAI_UNAVAILABLE, sem chamar a API", async () => {
    const chamadas = simularApiDeIa(() => respostaDaIa("não deveria chamar"));
    const chave = env.GENAI_API_KEY;
    env.GENAI_API_KEY = undefined;
    try {
      await assert.rejects(chamarApiDeIaGenerativa("contexto", "pergunta"), {
        name: "AppError",
        statusCode: 503,
        code: "GENAI_UNAVAILABLE",
      });
    } finally {
      env.GENAI_API_KEY = chave;
    }
    assert.equal(chamadas.length, 0);
  });

  test("429 da API: 429 GENAI_RATE_LIMITED", async () => {
    simularApiDeIa(() => new Response("limite", { status: 429 }));
    await assert.rejects(chamarApiDeIaGenerativa("contexto", "pergunta"), {
      statusCode: 429,
      code: "GENAI_RATE_LIMITED",
    });
  });

  test("outro erro da API (500): 502 GENAI_ERROR", async () => {
    mock.method(console, "error", () => {}); // o corpo do erro só vai para o log
    simularApiDeIa(() => new Response("falhou", { status: 500 }));
    await assert.rejects(chamarApiDeIaGenerativa("contexto", "pergunta"), {
      statusCode: 502,
      code: "GENAI_ERROR",
    });
  });

  test("falha de rede: 503 GENAI_UNAVAILABLE", async () => {
    simularApiDeIa(() => Promise.reject(new TypeError("fetch failed")));
    await assert.rejects(chamarApiDeIaGenerativa("contexto", "pergunta"), {
      statusCode: 503,
      code: "GENAI_UNAVAILABLE",
    });
  });

  test("API que não responde a tempo (GENAI_TIMEOUT_MS): 503 GENAI_UNAVAILABLE", async () => {
    // a resposta só "chega" quando o sinal de timeout da requisição dispara
    simularApiDeIa(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          // o timer do AbortSignal.timeout não segura o processo: este segura até o abort
          const espera = setTimeout(() => {}, 5000);
          init.signal!.addEventListener("abort", () => {
            clearTimeout(espera);
            reject(init.signal!.reason);
          });
        })
    );
    const tempo = env.GENAI_TIMEOUT_MS;
    env.GENAI_TIMEOUT_MS = 50;
    try {
      await assert.rejects(chamarApiDeIaGenerativa("contexto", "pergunta"), {
        statusCode: 503,
        code: "GENAI_UNAVAILABLE",
      });
    } finally {
      env.GENAI_TIMEOUT_MS = tempo;
    }
  });

  test("resposta sem conteúdo: 502 GENAI_ERROR", async () => {
    for (const corpo of [{ choices: [] }, { choices: [{ message: { content: "   " } }] }, {}]) {
      simularApiDeIa(() => Response.json(corpo));
      await assert.rejects(chamarApiDeIaGenerativa("contexto", "pergunta"), {
        statusCode: 502,
        code: "GENAI_ERROR",
      });
      mock.restoreAll();
    }
  });
});
