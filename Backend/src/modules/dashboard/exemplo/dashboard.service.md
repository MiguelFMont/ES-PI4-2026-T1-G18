# dashboard.service.ts — Regras de negócio do painel

## O que deve ter neste arquivo
- Não é dono de uma entidade própria: lê as transações do usuário (via `dashboardRepository`, que faz agregações sobre a coleção `transactions`).
- `getSummary`: agrega os totais do mês no MongoDB e manda **só os totais** ao Servidor Java, que calcula os indicadores (`PedidoCalcularIndicadores`: saldo, economia, fluxo de caixa). A fórmula é do Java; o Backend junta os totais e os indicadores na resposta.
- `getByCategory`: agrupa os totais por categoria (leitura simples via repository).
- `comparePeriods`: o Backend busca no MongoDB os totais de receitas e despesas por mês (`getTotaisPorMes`) e manda ao Servidor Java (`PedidoCompararPeriodos`), que calcula o saldo e a **variação percentual** de cada mês em relação ao anterior e a tendência das despesas. O parâmetro `periodo` vira a quantidade de meses (`mensal` = este mês contra o anterior; `ultimos-6-meses`). O Backend não faz a conta: devolve o que o Servidor calculou, pronto para o gráfico do Frontend.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.service.ts
import { dashboardRepository } from "./dashboard.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";

const MESES_POR_PERIODO: Record<string, number> = {
  mensal: 2, // este mês contra o anterior
  "ultimos-6-meses": 6,
};

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
    const meses = MESES_POR_PERIODO[periodo];
    if (!meses) {
      throw new AppError("Período inválido", 400, "VALIDATION_ERROR");
    }

    const periodos = await dashboardRepository.getTotaisPorMes(userId, meses);

    return javaServerClient.enviarPedido<
      { periodos: typeof periodos },
      { periodos: unknown[]; tendenciaDespesas: "alta" | "queda" | "estavel" }
    >("PedidoCompararPeriodos", "RespostaCompararPeriodos", { periodos });
  },
};
```
