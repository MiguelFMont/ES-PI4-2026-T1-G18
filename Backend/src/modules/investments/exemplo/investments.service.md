# investments.service.ts — Casos de uso de investimentos simulados

## O que deve ter neste arquivo
- Duas leituras, repassadas ao Servidor Java: `getPortfolio` (`PedidoPainelInvestimentos`) e `listInstallments` (`PedidoListarParcelamentos`).
- O Servidor lê os ativos simulados e os parcelamentos do banco, aplica a rentabilidade fictícia e devolve o patrimônio total e a lista de ativos. O Backend só envia o `userId` do token.
- Tudo é simulação: nenhuma integração com mercado real.

## Exemplo de implementação

```ts
// src/modules/investments/investments.service.ts
import { javaServerClient } from "../../java-client/java-server.client";

export const investmentsService = {
  getPortfolio(userId: string) {
    return javaServerClient.enviarPedido<
      { userId: string },
      { patrimonioTotal: number; ativos: { nome: string; valor: number; rentabilidade: number }[] }
    >("PedidoPainelInvestimentos", "RespostaPainelInvestimentos", { userId });
  },

  async listInstallments(userId: string) {
    const { parcelamentos } = await javaServerClient.enviarPedido<
      { userId: string },
      { parcelamentos: unknown[] }
    >("PedidoListarParcelamentos", "RespostaListarParcelamentos", { userId });
    return parcelamentos;
  },
};
```
