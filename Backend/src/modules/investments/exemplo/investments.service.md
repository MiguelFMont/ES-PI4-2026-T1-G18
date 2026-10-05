# investments.service.ts — Regras de negócio de investimentos

## O que deve ter neste arquivo
- `getPortfolio`: busca os investimentos simulados do usuário e pede ao Servidor Java a rentabilidade simulada (`PedidoRentabilidadeSimulada`) o Java decide a fórmula de rendimento fictício, o service só organiza o patrimônio total + a lista de ativos.
- `listInstallments`: lista os parcelamentos ativos do cartão (parcela atual/total, valor mensal) é leitura simples via repository, sem chamada ao Servidor Java.

## Exemplo de implementação

```ts
// src/modules/investments/investments.service.ts
import { investmentsRepository } from "./investments.repository";
import { JavaServerClient } from "../../java-client/java-server.client";

export const investmentsService = {
  async getPortfolio(userId: string, java: JavaServerClient) {
    const ativos = await investmentsRepository.findInvestmentsByUser(userId);

    const { patrimonioTotal, ativosComRentabilidade } = await java.enviarPedido<
      { ativos: typeof ativos },
      { patrimonioTotal: number; ativosComRentabilidade: typeof ativos }
    >("PedidoRentabilidadeSimulada", "RespostaRentabilidadeSimulada", { ativos });

    return { patrimonioTotal, ativos: ativosComRentabilidade };
  },

  async listInstallments(userId: string) {
    return investmentsRepository.findInstallmentsByUser(userId);
  },
};
```
