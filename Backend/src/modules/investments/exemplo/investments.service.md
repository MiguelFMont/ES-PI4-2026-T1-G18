# investments.service.ts — Regras de negócio de investimentos

## O que deve ter neste arquivo
- `getPortfolio`: busca os investimentos simulados do usuário no MongoDB e pede ao Servidor Java a rentabilidade simulada (`PedidoRentabilidadeSimulada`). O Java decide a fórmula do rendimento fictício; o service só organiza o patrimônio total e a lista de ativos.
- `listInstallments`: lê os parcelamentos ativos do cartão no MongoDB e pede ao Servidor Java o cálculo de cada um (`PedidoCalcularParcelamentos`): valor da parcela, total pago, **juros**, parcelas restantes e saldo devedor (Tabela Price). O Backend só converte `parcelaAtual` em `parcelasPagas` (parcela atual − 1), envia e devolve o que o Servidor calculou.

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
    const parcelamentos = await investmentsRepository.findInstallmentsByUser(userId);
    if (parcelamentos.length === 0) {
      return [];
    }

    const { parcelamentos: calculados } = await javaServerClient.enviarPedido<
      { parcelamentos: unknown[] },
      { parcelamentos: unknown[] }
    >("PedidoCalcularParcelamentos", "RespostaCalcularParcelamentos", {
      parcelamentos: parcelamentos.map((p) => ({
        id: String(p._id),
        descricao: p.descricao,
        valorTotal: p.valorTotal,
        parcelas: p.totalParcelas,
        parcelasPagas: Math.max(p.parcelaAtual - 1, 0),
        taxaJurosMensal: p.taxaJurosMensal ?? 0,
      })),
    });

    return calculados;
  },
};
```
