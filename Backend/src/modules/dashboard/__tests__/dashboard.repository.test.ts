// src/modules/dashboard/__tests__/dashboard.repository.test.ts
// Testes de repositório do Dashboard: valida as agregações do MongoDB em banco isolado.
import "./ambiente";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { dashboardRepository } from "../dashboard.repository";
import { encerrarBanco, iniciarBanco, limparBanco } from "../../connected-accounts/__tests__/banco";
import { dataMesesAtras, inserir, rotuloMesesAtras } from "./apoio";

before(iniciarBanco);
after(encerrarBanco);
beforeEach(limparBanco);

describe("dashboardRepository", () => {
    test("getTotaisDoMes soma apenas receitas e despesas do mês atual e do usuário", async () => {
        await inserir("ana", { tipo: "receita", valor: 3500, data: dataMesesAtras(0, 5) });
        await inserir("ana", { tipo: "despesa", valor: 450.5, data: dataMesesAtras(0, 10) });
        await inserir("ana", { tipo: "despesa", valor: 49.5, data: dataMesesAtras(0, 12) });
        // fora do mês atual e de outro usuário: não podem entrar
        await inserir("ana", { tipo: "despesa", valor: 900, data: dataMesesAtras(1, 15) });
        await inserir("beto", { tipo: "receita", valor: 9999, data: dataMesesAtras(0, 10) });

        const totais = await dashboardRepository.getTotaisDoMes("ana");

        assert.equal(totais.receitas, 3500);
        assert.equal(totais.despesas, 500);
    });

    test("getResumoDoPeriodo calcula totais, contagem e categoria de maior peso respeitando limites de data", async () => {
        await inserir("ana", { tipo: "despesa", valor: 550, categoria: "Lazer", data: new Date("2026-11-01T00:00:00.000Z") });
        await inserir("ana", { tipo: "despesa", valor: 250, categoria: "Alimentacao", data: new Date("2026-11-30T23:59:59.000Z") });
        await inserir("ana", { tipo: "receita", valor: 1000, categoria: "Salario", data: new Date("2026-11-15T12:00:00.000Z") });
        // fora do intervalo e de outro usuário
        await inserir("ana", { tipo: "despesa", valor: 5000, categoria: "Moradia", data: new Date("2026-10-31T23:59:59.999Z") });
        await inserir("beto", { tipo: "despesa", valor: 8000, categoria: "Transporte", data: new Date("2026-11-10T12:00:00.000Z") });

        const inicio = new Date("2026-11-01T00:00:00.000Z");
        const fim = new Date("2026-11-30T23:59:59.999Z");
        const { totais, topCategoria } = await dashboardRepository.getResumoDoPeriodo("ana", inicio, fim);

        assert.deepEqual(totais, {
        totalGasto: 800,
        totalReceitas: 1000,
        numeroTransacoes: 3,
        numeroDespesas: 2,
        });
        assert.deepEqual(topCategoria, { categoria: "Lazer", total: 550 });
    });

    test("getTotaisPorCategoria agrupa despesas da usuária sem misturar com outro usuário", async () => {
        await inserir("ana", { tipo: "despesa", valor: 120, categoria: "Alimentacao", data: dataMesesAtras(0, 10) });
        await inserir("ana", { tipo: "despesa", valor: 80, categoria: "Alimentacao", data: dataMesesAtras(0, 12) });
        await inserir("ana", { tipo: "despesa", valor: 300, categoria: "Moradia", data: dataMesesAtras(0, 14) });
        await inserir("beto", { tipo: "despesa", valor: 999, categoria: "Moradia", data: dataMesesAtras(0, 14) });

        const categorias = await dashboardRepository.getTotaisPorCategoria("ana");
        const mapa = new Map(
        categorias.map((c: any) => [c.categoria ?? c._id, Number(c.total)])
        );

        assert.equal(mapa.get("Alimentacao"), 200);
        assert.equal(mapa.get("Moradia"), 300);
        assert.equal(mapa.size, 2);
    });

    test("getTotaisPorMes agrupa por rótulo YYYY-MM e tipo a partir de dataInicio", async () => {
        await inserir("ana", { tipo: "receita", valor: 2000, data: dataMesesAtras(1, 15) });
        await inserir("ana", { tipo: "despesa", valor: 800, data: dataMesesAtras(0, 15) });
        await inserir("ana", { tipo: "despesa", valor: 500, data: dataMesesAtras(3, 15) }); // anterior ao corte

        const agora = new Date();
        const dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
        const grupos = await dashboardRepository.getTotaisPorMes("ana", dataInicio);

        const rotuloAnterior = rotuloMesesAtras(1);
        const rotuloAtual = rotuloMesesAtras(0);

        const recAnterior = grupos.find((g: any) => g._id.rotulo === rotuloAnterior && g._id.tipo === "receita")?.total;
        const despAtual = grupos.find((g: any) => g._id.rotulo === rotuloAtual && g._id.tipo === "despesa")?.total;

        assert.equal(recAnterior, 2000);
        assert.equal(despAtual, 800);
        assert.equal(grupos.length, 2);
    });
});