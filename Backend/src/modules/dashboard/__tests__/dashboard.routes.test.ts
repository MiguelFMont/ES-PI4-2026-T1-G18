// src/modules/dashboard/__tests__/dashboard.routes.test.ts
// Testes de ponta a ponta das rotas /v1/dashboard (issue #61): indicadores, resumo por período, categorias e comparação.
import { ANA, BETO, dataMesesAtras, inserir, json, prepararApi, rotuloMesesAtras, simularServidorDashboard } from "./apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

const { chamar } = prepararApi();

const getDashboard = (caminho: string, token: string | null = ANA) =>
    chamar("GET", `/dashboard${caminho}`, token ?? undefined);

describe("GET /v1/dashboard/summary", () => {
    test("calcula receitas, despesas, saldo, economia e fluxoDeCaixa do mês atual", async () => {
        simularServidorDashboard();
        await inserir("ana", { tipo: "receita", valor: 4000, categoria: "Salario", data: dataMesesAtras(0, 5) });
        await inserir("ana", { tipo: "despesa", valor: 1000, categoria: "Moradia", data: dataMesesAtras(0, 8) });
        await inserir("ana", { tipo: "despesa", valor: 550, categoria: "Alimentacao", data: dataMesesAtras(0, 12) });
        // transação do Beto não entra nos indicadores da Ana
        await inserir("beto", { tipo: "despesa", valor: 9000, categoria: "Lazer", data: dataMesesAtras(0, 12) });

        const resposta = await getDashboard("/summary");
        const corpo = await json(resposta);

        assert.equal(resposta.status, 200);
        assert.deepEqual(corpo, {
        receitas: 4000,
        despesas: 1550,
        saldo: 2450,
        economia: 61.25,
        fluxoDeCaixa: 2450,
        });
    });

    test("sem transações no mês: devolve todos os indicadores zerados", async () => {
        simularServidorDashboard();
        const resposta = await getDashboard("/summary");
        assert.equal(resposta.status, 200);
        assert.deepEqual(await json(resposta), {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        economia: 0,
        fluxoDeCaixa: 0,
        });
    });

    test("retorna 503 quando o Servidor Java está indisponível", async () => {
        simularServidorDashboard({ indisponivel: true });
        const resposta = await getDashboard("/summary");
        assert.equal(resposta.status, 503);
        assert.equal((await json(resposta)).error.code, "JAVA_SERVER_UNAVAILABLE");
    });
});

describe("GET /v1/dashboard/period-summary", () => {
    test("retorna resumo real do período e atualiza corretamente ao trocar o intervalo", async () => {
        // Outubro: R$ 2.000 receita, R$ 310 despesa (Moradia 200, Transporte 110)
        await inserir("ana", { tipo: "receita", valor: 2000, categoria: "Salario", data: new Date("2026-10-05T12:00:00.000Z") });
        await inserir("ana", { tipo: "despesa", valor: 200, categoria: "Moradia", data: new Date("2026-10-10T12:00:00.000Z") });
        await inserir("ana", { tipo: "despesa", valor: 110, categoria: "Transporte", data: new Date("2026-10-20T12:00:00.000Z") });

        // Novembro: R$ 800 despesa (Lazer 550, Alimentacao 250)
        await inserir("ana", { tipo: "despesa", valor: 550, categoria: "Lazer", data: new Date("2026-11-05T12:00:00.000Z") });
        await inserir("ana", { tipo: "despesa", valor: 250, categoria: "Alimentacao", data: new Date("2026-11-18T12:00:00.000Z") });

        // Beto em novembro (isolamento)
        await inserir("beto", { tipo: "despesa", valor: 9999, categoria: "Saude", data: new Date("2026-11-18T12:00:00.000Z") });

        const respNov = await getDashboard("/period-summary?dataInicio=2026-11-01&dataFim=2026-11-30");
        assert.equal(respNov.status, 200);
        assert.deepEqual(await json(respNov), {
        periodo: { dataInicio: "2026-11-01", dataFim: "2026-11-30", dias: 30 },
        totalGasto: 800,
        totalReceitas: 0,
        saldo: -800,
        numeroTransacoes: 2,
        numeroDespesas: 2,
        mediaDiaria: 26.67,
        categoriaMaiorPeso: {
            categoria: "Lazer",
            total: 550,
            percentual: 68.75,
        },
        });

        const respOut = await getDashboard("/period-summary?dataInicio=2026-10-01&dataFim=2026-10-31");
        assert.equal(respOut.status, 200);
        assert.deepEqual(await json(respOut), {
        periodo: { dataInicio: "2026-10-01", dataFim: "2026-10-31", dias: 31 },
        totalGasto: 310,
        totalReceitas: 2000,
        saldo: 1690,
        numeroTransacoes: 3,
        numeroDespesas: 2,
        mediaDiaria: 10,
        categoriaMaiorPeso: {
            categoria: "Moradia",
            total: 200,
            percentual: 64.52,
        },
        });
    });

    test("período sem transações retorna zeros e categoriaMaiorPeso null", async () => {
        const resposta = await getDashboard("/period-summary?dataInicio=2025-01-01&dataFim=2025-01-31");
        const corpo = await json(resposta);

        assert.equal(resposta.status, 200);
        assert.equal(corpo.totalGasto, 0);
        assert.equal(corpo.numeroTransacoes, 0);
        assert.equal(corpo.mediaDiaria, 0);
        assert.equal(corpo.categoriaMaiorPeso, null);
    });

    test("datas inválidas ou invertidas devolvem 400 VALIDATION", async () => {
        const invalidas = [
        "/period-summary?dataInicio=invalida&dataFim=2026-11-30",
        "/period-summary?dataInicio=2026-02-31&dataFim=2026-03-01",
        "/period-summary?dataInicio=2026-11-30&dataFim=2026-11-01",
        ];

        for (const rota of invalidas) {
        const resposta = await getDashboard(rota);
        assert.equal(resposta.status, 400, rota);
        assert.equal((await json(resposta)).error.code, "VALIDATION");
        }
    });
});

describe("GET /v1/dashboard/by-category", () => {
    test("devolve gastos agrupados por categoria apenas do usuário autenticado", async () => {
        await inserir("ana", { tipo: "despesa", valor: 300, categoria: "Alimentacao", data: dataMesesAtras(0, 10) });
        await inserir("ana", { tipo: "despesa", valor: 150, categoria: "Lazer", data: dataMesesAtras(0, 12) });
        await inserir("beto", { tipo: "despesa", valor: 700, categoria: "Lazer", data: dataMesesAtras(0, 12) });

        const resposta = await getDashboard("/by-category");
        const lista = await json(resposta);

        assert.equal(resposta.status, 200);
        assert.ok(Array.isArray(lista));
        const mapa = new Map(lista.map((i: any) => [i.categoria ?? i._id, Number(i.total)]));
        assert.equal(mapa.get("Alimentacao"), 300);
        assert.equal(mapa.get("Lazer"), 150);
    });
});

describe("GET /v1/dashboard/compare", () => {
    test("compara mês atual vs anterior (padrão) calculando variações e tendência", async () => {
        simularServidorDashboard();
        await inserir("ana", { tipo: "receita", valor: 2000, data: dataMesesAtras(1, 15) });
        await inserir("ana", { tipo: "despesa", valor: 1000, data: dataMesesAtras(1, 15) });
        await inserir("ana", { tipo: "receita", valor: 2500, data: dataMesesAtras(0, 15) });
        await inserir("ana", { tipo: "despesa", valor: 1200, data: dataMesesAtras(0, 15) });

        const resposta = await getDashboard("/compare?periodo=mes");
        const corpo = await json(resposta);

        assert.equal(resposta.status, 200);
        assert.equal(corpo.periodos.length, 2);
        assert.equal(corpo.periodos[0].rotulo, rotuloMesesAtras(1));
        assert.equal(corpo.periodos[1].rotulo, rotuloMesesAtras(0));
        assert.equal(corpo.periodos[1].variacaoDespesas, 20);
        assert.equal(corpo.tendenciaDespesas, "alta");
    });

    test("suporta periodo=6meses e periodo=ytd", async () => {
        simularServidorDashboard();

        const resp6m = await getDashboard("/compare?periodo=6meses");
        assert.equal(resp6m.status, 200);
        assert.equal((await json(resp6m)).periodos.length, 6);

        const respYtd = await getDashboard("/compare?periodo=ytd");
        assert.equal(respYtd.status, 200);
        assert.equal((await json(respYtd)).periodos.length, new Date().getMonth() + 1);
    });

    test("período inválido devolve 400 VALIDATION", async () => {
        simularServidorDashboard();
        const resposta = await getDashboard("/compare?periodo=semanal");
        assert.equal(resposta.status, 400);
        assert.equal((await json(resposta)).error.code, "VALIDATION");
    });
});

describe("Autenticação nas rotas de /v1/dashboard", () => {
    const rotas = ["/summary", "/period-summary", "/by-category", "/compare"];

    for (const rota of rotas) {
        test(`GET /v1/dashboard${rota} sem token devolve 401 UNAUTHENTICATED`, async () => {
        const resposta = await getDashboard(rota, null);
        assert.equal(resposta.status, 401);
        assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
        });

        test(`GET /v1/dashboard${rota} com token inválido devolve 401 UNAUTHENTICATED`, async () => {
        const resposta = await getDashboard(rota, "token.invalido.aqui");
        assert.equal(resposta.status, 401);
        assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
        });
    }
});