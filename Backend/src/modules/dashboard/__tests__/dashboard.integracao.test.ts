// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
// Teste de integração com o Servidor Java real. Só executa quando JAVA_SERVER_INTEGRACAO=1.
import { ANA, dataMesesAtras, inserir, json, prepararApi } from "./apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

const RODAR = process.env.JAVA_SERVER_INTEGRACAO === "1";

describe("Integração Dashboard + Servidor Java real", { skip: !RODAR }, () => {
    const { chamar } = prepararApi();

    test("GET /v1/dashboard/summary recebe indicadores reais do Servidor Java", async () => {
        await inserir("ana", { tipo: "receita", valor: 3000, data: dataMesesAtras(0, 10) });
        await inserir("ana", { tipo: "despesa", valor: 1200, data: dataMesesAtras(0, 12) });

        const resposta = await chamar("GET", "/dashboard/summary", ANA);
        const corpo = await json(resposta);

        assert.equal(resposta.status, 200);
        assert.equal(corpo.receitas, 3000);
        assert.equal(corpo.despesas, 1200);
        assert.equal(corpo.saldo, 1800);
        assert.equal(corpo.economia, 60);
    });

    test("GET /v1/dashboard/compare recebe comparação e tendência reais do Servidor Java", async () => {
        await inserir("ana", { tipo: "receita", valor: 2000, data: dataMesesAtras(1, 15) });
        await inserir("ana", { tipo: "despesa", valor: 800, data: dataMesesAtras(1, 15) });
        await inserir("ana", { tipo: "receita", valor: 2000, data: dataMesesAtras(0, 15) });
        await inserir("ana", { tipo: "despesa", valor: 1000, data: dataMesesAtras(0, 15) });

        const resposta = await chamar("GET", "/dashboard/compare?periodo=mes", ANA);
        const corpo = await json(resposta);

        assert.equal(resposta.status, 200);
        assert.equal(corpo.periodos.length, 2);
        assert.ok(["alta", "queda", "estavel"].includes(corpo.tendenciaDespesas));
    });
});