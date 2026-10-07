# dashboard.service.ts — Casos de uso do painel

## O que deve ter neste arquivo
- Três consultas de leitura, cada uma repassada ao Servidor Java, que lê as transações do banco, agrega e calcula: `getSummary` (`PedidoResumoPainel`), `getByCategory` (`PedidoGastosPorCategoria`) e `comparePeriods` (`PedidoCompararPeriodos`).
- O Backend não agrega nem calcula nada: só envia o `userId` do token (e o `periodo`, na comparação) e devolve o resultado ao Frontend.
- O painel não tem coleção própria; ele lê as transações do módulo `transactions`, mas essa leitura acontece dentro do Servidor.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.service.ts
import { javaServerClient } from "../../java-client/java-server.client";

export const dashboardService = {
  getSummary(userId: string) {
    return javaServerClient.enviarPedido<
      { userId: string },
      { receitas: number; despesas: number; saldo: number; economia: number; fluxoDeCaixa: number }
    >("PedidoResumoPainel", "RespostaResumoPainel", { userId });
  },

  async getByCategory(userId: string) {
    const { categorias } = await javaServerClient.enviarPedido<
      { userId: string },
      { categorias: { categoria: string; total: number }[] }
    >("PedidoGastosPorCategoria", "RespostaGastosPorCategoria", { userId });
    return categorias;
  },

  async comparePeriods(userId: string, periodo: string) {
    const { periodos } = await javaServerClient.enviarPedido<
      { userId: string; periodo: string },
      { periodos: { ano: number; mes: number; total: number }[] }
    >("PedidoCompararPeriodos", "RespostaCompararPeriodos", { userId, periodo });
    return periodos;
  },
};
```
