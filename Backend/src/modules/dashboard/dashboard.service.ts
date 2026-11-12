// src/modules/dashboard/dashboard.service.ts
import { dashboardRepository } from "./dashboard.repository";
import {
    ComparePeriodsResponseDto,
    DashboardSummaryDto,
    PeriodoBrutoDto,
    TipoPeriodoComparacao,
} from "./dashboard.dto";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";

function formatarRotuloMes(ano: number, mesIndex: number): string {
    const data = new Date(ano, mesIndex, 1);
    const y = data.getFullYear();
    const m = String(data.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function obterIntervaloDeMeses(periodo: TipoPeriodoComparacao): {
    dataInicio: Date;
    rotulos: string[];
} {
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth();

    let qtdMeses = 2;
    if (periodo === "6meses") {
        qtdMeses = 6;
    } else if (periodo === "ytd") {
        qtdMeses = mesAtual + 1;
    }

    const mesInicialIndex = mesAtual - (qtdMeses - 1);
    const dataInicio = new Date(anoAtual, mesInicialIndex, 1);

    const rotulos: string[] = [];
    for (let i = mesInicialIndex; i <= mesAtual; i++) {
        rotulos.push(formatarRotuloMes(anoAtual, i));
    }

    return { dataInicio, rotulos };
}

export const dashboardService = {
    async getSummary(userId: string): Promise<DashboardSummaryDto> {
        const { receitas, despesas } = await dashboardRepository.getTotaisDoMes(userId);

        const indicadores = await javaServerClient.enviarPedido<
            { receitas: number; despesas: number },
            { saldo: number; economia: number; fluxoDeCaixa: number }
        >(
            "PedidoCalcularIndicadores",
            "RespostaCalcularIndicadores",
            { receitas, despesas }
        );

        return {
            receitas: Number(receitas.toFixed(2)),
            despesas: Number(despesas.toFixed(2)),
            saldo: Number(indicadores.saldo.toFixed(2)),
            economia: Number(indicadores.economia.toFixed(2)),
            fluxoDeCaixa: Number(indicadores.fluxoDeCaixa.toFixed(2)),
        };
    },

    async getByCategory(userId: string) {
        return dashboardRepository.getTotaisPorCategoria(userId);
    },

    async comparePeriods(
        userId: string,
        periodoParam: string = "mes"
    ): Promise<ComparePeriodsResponseDto> {
        const normalizado = periodoParam.toLowerCase();
        const mapaPeriodos: Record<string, TipoPeriodoComparacao> = {
            mes: "mes",
            mensal: "mes",
            "6meses": "6meses",
            semestral: "6meses",
            ytd: "ytd",
            ano: "ytd",
        };

        const periodo = mapaPeriodos[normalizado];
        if (!periodo) {
            throw new AppError(
                "Tipo de período inválido. Use 'mes', '6meses' ou 'ytd'.",
                400,
                "VALIDATION"
            );
        }

        const { dataInicio, rotulos } = obterIntervaloDeMeses(periodo);
        const grupos = await dashboardRepository.getTotaisPorMes(userId, dataInicio);

        const periodos: PeriodoBrutoDto[] = rotulos.map((rotulo) => {
            const receitas =
                grupos.find((g) => g._id.rotulo === rotulo && g._id.tipo === "receita")?.total ?? 0;
            const despesas =
                grupos.find((g) => g._id.rotulo === rotulo && g._id.tipo === "despesa")?.total ?? 0;

            return {
                rotulo,
                receitas: Number(receitas.toFixed(2)),
                despesas: Number(despesas.toFixed(2)),
            };
        });

        return javaServerClient.enviarPedido<
            { periodos: PeriodoBrutoDto[] },
            ComparePeriodsResponseDto
        >(
            "PedidoCompararPeriodos",
            "RespostaCompararPeriodos",
            { periodos }
        );
    },
};