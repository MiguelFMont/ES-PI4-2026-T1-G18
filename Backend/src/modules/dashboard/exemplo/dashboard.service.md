# dashboard.service.ts — Regras de negócio do painel

## O que deve ter neste arquivo
- Não é dono de uma entidade própria: lê as transações do usuário (via `dashboardRepository`, que faz agregações sobre a coleção `transactions`).
- `getSummary`: agrega os totais do mês no MongoDB e manda **só os totais** ao Servidor Java, que calcula os indicadores (`PedidoCalcularIndicadores`: saldo, economia, fluxo de caixa). A fórmula é do Java; o Backend junta os totais e os indicadores na resposta.
- `getByCategory`: agrupa os totais por categoria (leitura simples via repository).
- `comparePeriods`: busca os agregados de cada período e devolve a série pronta para o gráfico do Frontend.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.service.ts
import { dashboardRepository } from "./dashboard.repository";
import { javaServerClient } from "../../java-client/java-server.client";

export const dashboardService = {
  async getSummary(userId: string) {
    const totaisDoMes = await dashboardRepository.getTotaisDoMes(userId);

    const indicadores = await javaServerClient.enviarPedido<
      { receitas: number; despesas: number },
      { saldo: number; economia: number; fluxoDeCaixa: number }
    >("PedidoCalcularIndicadores", "RespostaCalcularIndicadores", totaisDoMes);

    return { ...totaisDoMes, ...indicadores };
  },

  async getByCategory(userId: string) {
    return dashboardRepository.getTotaisPorCategoria(userId);
  },

  async comparePeriods(userId: string, periodo: string) {
    return dashboardRepository.getComparativoPorPeriodo(userId, periodo);
  },
};
```
