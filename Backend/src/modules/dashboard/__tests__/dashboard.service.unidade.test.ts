// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
// Testes de unidade do dashboardService: valida cálculos, arredondamento, preenchimento de meses e erros sem tocar no banco.
import "./ambiente";
import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { dashboardService } from "../dashboard.service";
import { dashboardRepository } from "../dashboard.repository";
import { AppError } from "../../../shared/errors/app-error";
import { rotuloMesesAtras, simularServidorDashboard } from "./apoio";

afterEach(() => mock.restoreAll());

describe("dashboardService.getSummary (unidade)", () => {
    test("envia receitas e despesas ao Servidor Java e devolve indicadores arredondados em 2 casas", async () => {
        mock.method(dashboardRepository, "getTotaisDoMes", async () => ({
        receitas: 4000.126,
        despesas: 1550.004,
        }));
        const pedidos = simularServidorDashboard();

        const resumo = await dashboardService.getSummary("ana");

        assert.equal(pedidos.length, 1);
        assert.equal(pedidos[0].tipoPedido, "PedidoCalcularIndicadores");
        assert.equal(resumo.receitas, 4000.13);
        assert.equal(resumo.despesas, 1550);
        assert.equal(resumo.saldo, 2450.12);
        assert.equal(resumo.fluxoDeCaixa, 2450.12);
        assert.equal(resumo.economia, 61.25);
    });

    test("propaga erro 503 quando o Servidor Java está indisponível", async () => {
        mock.method(dashboardRepository, "getTotaisDoMes", async () => ({ receitas: 1000, despesas: 200 }));
        simularServidorDashboard({ indisponivel: true });

        await assert.rejects(
        () => dashboardService.getSummary("ana"),
        (erro: unknown) => erro instanceof AppError && erro.statusCode === 503
        );
    });
});

describe("dashboardService.getPeriodSummary (unidade)", () => {
    test("calcula totalGasto, mediaDiaria, numeroTransacoes e categoriaMaiorPeso corretamente", async () => {
        mock.method(dashboardRepository, "getResumoDoPeriodo", async () => ({
        totais: {
            totalGasto: 800,
            totalReceitas: 2000,
            numeroTransacoes: 4,
            numeroDespesas: 3,
        },
        topCategoria: { categoria: "Lazer", total: 550 },
        }));

        const resumo = await dashboardService.getPeriodSummary("ana", "2026-11-01", "2026-11-30");

        assert.deepEqual(resumo, {
        periodo: { dataInicio: "2026-11-01", dataFim: "2026-11-30", dias: 30 },
        totalGasto: 800,
        totalReceitas: 2000,
        saldo: 1200,
        numeroTransacoes: 4,
        numeroDespesas: 3,
        mediaDiaria: 26.67,
        categoriaMaiorPeso: {
            categoria: "Lazer",
            total: 550,
            percentual: 68.75,
        },
        });
    });

    test("período de 1 único dia não divide por zero e retorna mediaDiaria igual ao totalGasto", async () => {
        mock.method(dashboardRepository, "getResumoDoPeriodo", async () => ({
        totais: { totalGasto: 120.5, totalReceitas: 0, numeroTransacoes: 1, numeroDespesas: 1 },
        topCategoria: { categoria: "Alimentacao", total: 120.5 },
        }));

        const resumo = await dashboardService.getPeriodSummary("ana", "2026-11-10", "2026-11-10");

        assert.equal(resumo.periodo.dias, 1);
        assert.equal(resumo.mediaDiaria, 120.5);
        assert.equal(resumo.categoriaMaiorPeso?.percentual, 100);
    });

    test("sem despesas no período: devolve zeros e categoriaMaiorPeso null", async () => {
        mock.method(dashboardRepository, "getResumoDoPeriodo", async () => ({
        totais: { totalGasto: 0, totalReceitas: 1500, numeroTransacoes: 1, numeroDespesas: 0 },
        topCategoria: null,
        }));

        const resumo = await dashboardService.getPeriodSummary("ana", "2026-10-01", "2026-10-31");

        assert.equal(resumo.totalGasto, 0);
        assert.equal(resumo.mediaDiaria, 0);
        assert.equal(resumo.categoriaMaiorPeso, null);
        assert.equal(resumo.saldo, 1500);
    });

    test("rejeita formato inválido, data inexistente (31/02) e dataInicio maior que dataFim (400 VALIDATION)", async () => {
        const casos: [string, string][] = [
        ["ontem", "2026-11-30"],
        ["2026-11-01", "30/11/2026"],
        ["2026-02-31", "2026-03-05"],
        ["2026-11-30", "2026-11-01"],
        ];

        for (const [inicio, fim] of casos) {
        await assert.rejects(
            () => dashboardService.getPeriodSummary("ana", inicio, fim),
            (erro: unknown) => erro instanceof AppError && erro.statusCode === 400 && erro.code === "VALIDATION",
            `deveria rejeitar ${inicio} -> ${fim}`
        );
        }
    });
});

describe("dashboardService.comparePeriods (unidade)", () => {
    test("preenche meses sem movimento com 0 e aceita apelidos ('mensal', 'semestral', 'ano')", async () => {
        const mesAtual = rotuloMesesAtras(0);
        mock.method(dashboardRepository, "getTotaisPorMes", async () => [
        { _id: { rotulo: mesAtual, tipo: "receita" }, total: 3000 },
        { _id: { rotulo: mesAtual, tipo: "despesa" }, total: 1200 },
        ]);
        const pedidos = simularServidorDashboard();

        const resposta6m = await dashboardService.comparePeriods("ana", "semestral");
        assert.equal(resposta6m.periodos.length, 6);
        assert.equal(pedidos[0].tipoPedido, "PedidoCompararPeriodos");

        const primeiroMes = resposta6m.periodos[0];
        assert.equal(primeiroMes.receitas, 0);
        assert.equal(primeiroMes.despesas, 0);

        const ultimoMes = resposta6m.periodos[5];
        assert.equal(ultimoMes.rotulo, mesAtual);
        assert.equal(ultimoMes.receitas, 3000);
        assert.equal(ultimoMes.despesas, 1200);
    });

    test("rejeita tipo de período inválido com 400 VALIDATION", async () => {
        await assert.rejects(
        () => dashboardService.comparePeriods("ana", "quinzenal"),
        (erro: unknown) => erro instanceof AppError && erro.statusCode === 400 && erro.code === "VALIDATION"
        );
    });
});