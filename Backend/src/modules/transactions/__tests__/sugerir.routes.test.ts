// src/modules/transactions/__tests__/sugerir.routes.test.ts
// POST /v1/transactions/suggest-category: o botão "Sugerir" do formulário de novo lançamento. Pergunta a categoria ao
// Servidor Java (simulado) sem gravar nada; se o Servidor estiver fora do ar, avisa (503) em vez de inventar uma categoria.
import { ANA, json, prepararApi, textoDe } from "./apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { TransactionModel } from "../transactions.model";
import { simularCategorizacao } from "../../connected-accounts/__tests__/apoio";

const { chamar } = prepararApi();

// `null` = chamada sem login (um parâmetro padrão trocaria o undefined pelo token da Ana)
const sugerir = (corpo: unknown, token: string | null = ANA) => chamar("POST", "/transactions/suggest-category", token ?? undefined, corpo);

describe("POST /v1/transactions/suggest-category", () => {
  test("devolve a categoria que o Servidor sugere para a descrição (200) e não grava nada", async () => {
    const pedidos = simularCategorizacao();
    const resposta = await sugerir({ descricao: "Netflix assinatura", valor: 39.9 });

    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { categoria: "Lazer" });
    assert.deepEqual(pedidos, [{ descricao: "Netflix assinatura", valor: 39.9 }]);
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("o valor é opcional: vai 0 ao Servidor e a descrição tem os espaços das pontas cortados", async () => {
    const pedidos = simularCategorizacao();
    const resposta = await sugerir({ descricao: "  Condominio  " });

    assert.equal(resposta.status, 200);
    assert.equal((await json(resposta)).categoria, "Moradia");
    assert.deepEqual(pedidos, [{ descricao: "Condominio", valor: 0 }]);
  });

  test("descrição que o Servidor não reconhece volta como Outros", async () => {
    simularCategorizacao();
    assert.equal((await json(await sugerir({ descricao: "xyzzy" }))).categoria, "Outros");
  });

  test("Servidor Java fora do ar: 503 JAVA_SERVER_UNAVAILABLE (não devolve uma categoria inventada)", async () => {
    simularCategorizacao({ indisponivel: true });
    const resposta = await sugerir({ descricao: "Netflix" });

    assert.equal(resposta.status, 503);
    assert.equal((await json(resposta)).error.code, "JAVA_SERVER_UNAVAILABLE");
  });

  test("descrição ausente, em branco ou grande demais: 400 VALIDATION_ERROR e o Servidor nem é consultado", async () => {
    const pedidos = simularCategorizacao();
    for (const corpo of [{}, { descricao: "   " }, { descricao: textoDe(201) }, { descricao: "ok", valor: -1 }]) {
      const resposta = await sugerir(corpo);
      assert.equal(resposta.status, 400, JSON.stringify(corpo).slice(0, 40));
      assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    }
    assert.equal(pedidos.length, 0);
  });

  test("sem login: 401", async () => {
    simularCategorizacao();
    assert.equal((await sugerir({ descricao: "Netflix" }, null)).status, 401);
  });
});
