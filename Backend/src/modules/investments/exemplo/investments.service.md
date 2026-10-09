# investments.service.ts — Regras de negócio de investimentos

## O que deve ter neste arquivo
- `getPortfolio`: busca os investimentos simulados do usuário no MongoDB e pede ao Servidor Java a rentabilidade simulada (`PedidoRentabilidadeSimulada`). O Java decide a fórmula do rendimento fictício; o service só organiza o patrimônio total e a lista de ativos.
- `listInstallments`: lista os parcelamentos ativos do cartão (parcela atual/total, valor mensal). É leitura simples via repository, sem chamada ao Servidor Java.

## Exemplo de implementação

```ts
// src/modules/investments/investments.service.ts
import { investmentsRepository } from "./investments.repository";
import { javaServerClient } from "../../java-client/java-server.client";

export const investmentsService = {
  async getPortfolio(userId: string) {
    const ativos = await investmentsRepository.findInvestmentsByUser(userId);

    const { patrimonioTotal, ativosComRentabilidade } = await javaServerClient.enviarPedido<
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
