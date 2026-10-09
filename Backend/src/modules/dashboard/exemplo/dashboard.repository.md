# dashboard.repository.ts — Agregações sobre transações

## O que deve ter neste arquivo
- Consultas de agregação (`aggregate`) sobre a coleção de transações, sempre filtradas por `userId`: total de receitas/despesas do mês, soma agrupada por categoria e totais de receitas e despesas **por mês** (`getTotaisPorMes`), que o service manda ao Servidor Java para comparar os períodos. O repository só agrega; a comparação (variações em %, tendência) é cálculo do Servidor.
- Não importa o `TransactionModel` diretamente sem necessidade este repository pode reexportar/usar o model do módulo `transactions`, já que o painel não é dono dos dados, só os lê.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.repository.ts
import { TransactionModel } from "../transactions/transactions.model";

export const dashboardRepository = {
  async getTotaisDoMes(userId: string) {
    const inicioDoMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const grupos = await TransactionModel.aggregate([
      { $match: { userId, data: { $gte: inicioDoMes } } },
      {
        $group: {
          _id: "$tipo",
          total: { $sum: "$valor" },
        },
      },
    ]);

    const total = (tipo: string) => grupos.find((g) => g._id === tipo)?.total ?? 0;
    return { receitas: total("receita"), despesas: total("despesa") };
  },

  async getTotaisPorCategoria(userId: string) {
    return TransactionModel.aggregate([
      { $match: { userId, tipo: "despesa" } },
      { $group: { _id: "$categoria", total: { $sum: "$valor" } } },
      { $sort: { total: -1 } },
    ]);
  },

  // Receitas e despesas dos últimos `meses` meses (inclui o mês atual), do mais antigo ao
  // mais recente, com um item por mês mesmo quando não há transações (zeros).
  async getTotaisPorMes(userId: string, meses: number) {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth() - (meses - 1), 1);
    const timezone = "America/Sao_Paulo";

    const grupos = await TransactionModel.aggregate([
      { $match: { userId, data: { $gte: inicio } } },
      {
        $group: {
          _id: {
            ano: { $year: { date: "$data", timezone } },
            mes: { $month: { date: "$data", timezone } },
            tipo: "$tipo",
          },
          total: { $sum: "$valor" },
        },
      },
    ]);

    const periodos: Array<{ rotulo: string; receitas: number; despesas: number }> = [];
    for (let i = 0; i < meses; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
      const soma = (tipo: string) =>
        grupos.find(
          (g) => g._id.ano === d.getFullYear() && g._id.mes === d.getMonth() + 1 && g._id.tipo === tipo
        )?.total ?? 0;

      periodos.push({
        rotulo: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        receitas: soma("receita"),
        despesas: soma("despesa"),
      });
    }
    return periodos;
  },
};
```
