# dashboard.service.ts — Regras de negócio do painel

## O que deve ter neste arquivo
- Não é dono de uma entidade própria: lê as transações do usuário (via `dashboardRepository`, que faz agregações sobre a coleção `transactions`) e manda os totais calculados para o Servidor Java calcular os indicadores (`PedidoCalcularIndicadores`).
- `getByCategory`: agrupa os totais por categoria e por grupo de categoria (ex.: "Alimentação" = mercado + restaurante).
- `comparePeriods`: busca os agregados de cada período e devolve a série pronta para o gráfico do Frontend.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.service.ts
import { dashboardRepository } from "./dashboard.repository";
import { JavaServerClient } from "../../java-client/java-server.client";

export const dashboardService = {
  async getSummary(userId: string, java: JavaServerClient) {
    const totaisDoMes = await dashboardRepository.getTotaisDoMes(userId);

    const indicadores = await java.enviarPedido<
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
