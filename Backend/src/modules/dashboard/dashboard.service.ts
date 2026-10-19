// src/modules/dashboard/dashboard.service.ts
import { dashboardRepository } from "./dashboard.repository";
import { DashboardSummaryDto } from "./dashboard.dto";

// Sprint 1: saldo e indicadores usam conta simples no Backend.
// Sprint 2 (issue #36): o Servidor Java calcula os indicadores (PedidoCalcularIndicadores).
export const dashboardService = {
    async getSummary(userId: string): Promise<DashboardSummaryDto> {
        const { receitas, despesas } = await dashboardRepository.getTotaisDoMes(userId);

        const saldo = receitas - despesas;
        const economia = receitas > 0 ? Number((((receitas - despesas) / receitas) * 100).toFixed(2)) : 0;
        const fluxoDeCaixa = saldo;

        return {
        receitas,
        despesas,
        saldo,
        economia,
        fluxoDeCaixa,
        };
    },

    async getByCategory(userId: string) {
        return dashboardRepository.getTotaisPorCategoria(userId);
    },
};