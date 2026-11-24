// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
import { dashboardRepository } from "./dashboard.repository";
import {
    ComparePeriodsResponseDto,
    DashboardSummaryDto,
    PeriodoBrutoDto,
    PeriodSummaryResponseDto,
    TipoPeriodoComparacao,
} from "./dashboard.dto";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";

const DATA_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const emReais = (valor: number) => Math.round(valor * 100) / 100;

function parseDataIso(texto: string, fimDoDia: boolean): Date {
    if (!DATA_ISO_REGEX.test(texto)) {
        throw new AppError(
            "Data inválida. Use o formato YYYY-MM-DD.",
            400,
            "VALIDATION"
        );
    }

    const sufixo = fimDoDia ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const data = new Date(`${texto}${sufixo}`);

    // Garante que datas impossíveis como 2026-02-31 não virem 2026-03-03
    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
        throw new AppError(
            `Data inexistente: ${texto}.`,
            400,
            "VALIDATION"
        );
    }

    return data;
}

function resolverPeriodo(dataInicioStr?: string, dataFimStr?: string) {
    const agora = new Date();
    const inicioPadrao = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1, 0, 0, 0, 0));
    const fimPadrao = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const inicio = dataInicioStr ? parseDataIso(dataInicioStr, false) : inicioPadrao;
    const fim = dataFimStr ? parseDataIso(dataFimStr, true) : fimPadrao;

    if (inicio > fim) {
        throw new AppError(
            "dataInicio não pode ser maior que dataFim.",
            400,
            "VALIDATION"
        );
    }

    const inicioDia = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
    const fimDia = Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate());
    const dias = Math.max(1, Math.floor((fimDia - inicioDia) / UM_DIA_MS) + 1);

    return {
        inicio,
        fim,
        dias,
        dataInicioIso: inicio.toISOString().slice(0, 10),
        dataFimIso: fim.toISOString().slice(0, 10),
    };
}

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

    async getPeriodSummary(
        userId: string,
        dataInicio?: string,
        dataFim?: string
    ): Promise<PeriodSummaryResponseDto> {
        const { inicio, fim, dias, dataInicioIso, dataFimIso } = resolverPeriodo(dataInicio, dataFim);
        const { totais, topCategoria } = await dashboardRepository.getResumoDoPeriodo(userId, inicio, fim);

        const totalGasto = emReais(totais.totalGasto);
        const totalReceitas = emReais(totais.totalReceitas);
        const saldo = emReais(totalReceitas - totalGasto);
        const mediaDiaria = emReais(totalGasto / dias);

        const categoriaMaiorPeso =
            topCategoria && totalGasto > 0
                ? {
                    categoria: topCategoria.categoria,
                    total: emReais(topCategoria.total),
                    percentual: emReais((topCategoria.total / totalGasto) * 100),
                }
                : null;

        return {
            periodo: {
                dataInicio: dataInicioIso,
                dataFim: dataFimIso,
                dias,
            },
            totalGasto,
            totalReceitas,
            saldo,
            numeroTransacoes: totais.numeroTransacoes,
            numeroDespesas: totais.numeroDespesas,
            mediaDiaria,
            categoriaMaiorPeso,
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