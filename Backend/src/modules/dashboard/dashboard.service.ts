// src/modules/dashboard/dashboard.service.ts
import { dashboardRepository } from "./dashboard.repository";
import { DashboardSummaryDto } from "./dashboard.dto";
import { javaServerClient } from "../../java-client/java-server.client"; 

export const dashboardService = {
    async getSummary(userId: string): Promise<DashboardSummaryDto> {
        // 1. O Backend busca os totais brutos no MongoDB (igual à Sprint 1)
        const { receitas, despesas } = await dashboardRepository.getTotaisDoMes(userId);

        // 2. Envia as receitas e despesas para o Servidor Java (Sprint 2 - Issue #37)
        const indicadores = await javaServerClient.enviarPedido<
            { receitas: number; despesas: number },
            { saldo: number; economia: number; fluxoDeCaixa: number }
        >(
            "PedidoCalcularIndicadores",
            "RespostaCalcularIndicadores",
            { receitas, despesas }
        );

        // 3. Devolve para o Frontend unindo os dados do Mongo com as contas do Java
        return {
            receitas: Number(receitas.toFixed(2)),
            despesas: Number(despesas.toFixed(2)),
            saldo: Number(indicadores.saldo.toFixed(2)),
            economia: Number(indicadores.economia.toFixed(2)),
            fluxoDeCaixa: Number(indicadores.fluxoDeCaixa.toFixed(2)),
        };
    },

    // Mantemos o getByCategory original da Sprint 1, sem os filtros de mês (que ficam para a Sprint 3)
    async getByCategory(userId: string) {
        return dashboardRepository.getTotaisPorCategoria(userId);
    },
};