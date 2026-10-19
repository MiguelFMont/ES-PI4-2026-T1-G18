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