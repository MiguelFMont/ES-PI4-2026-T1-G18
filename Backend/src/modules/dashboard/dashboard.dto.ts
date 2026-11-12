// src/modules/dashboard/dashboard.dto.ts
export interface DashboardSummaryDto {
    receitas: number;
    despesas: number;
    saldo: number;
    economia: number;
    fluxoDeCaixa: number;
}

export interface CategoryBreakdownDto {
    categoria: string;
    total: number;
}

export interface PeriodComparisonDto {
    rotulo: string;
    receitas: number;
    despesas: number;
    saldo: number;
    variacaoReceitas: number;
    variacaoDespesas: number;
    variacaoSaldo: number;
}

export type TipoPeriodoComparacao = "mes" | "6meses" | "ytd";

export interface PeriodoBrutoDto {
    rotulo: string;
    receitas: number;
    despesas: number;
}

export interface ComparePeriodsResponseDto {
    periodos: PeriodComparisonDto[];
    tendenciaDespesas: "alta" | "queda" | "estavel";
}