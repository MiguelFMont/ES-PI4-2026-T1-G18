# dashboard.repository.ts — Agregações sobre transações

## O que deve ter neste arquivo
- Consultas de agregação (`aggregate`) sobre a coleção de transações, sempre filtradas por `userId`: total de receitas/despesas do mês, soma agrupada por categoria, soma agrupada por período.
- Não importa o `TransactionModel` diretamente sem necessidade este repository pode reexportar/usar o model do módulo `transactions`, já que o painel não é dono dos dados, só os lê.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.repository.ts
import { TransactionModel } from "../transactions/transactions.model";

export const dashboardRepository = {
  async getTotaisDoMes(userId: string) {
    const inicioDoMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [totais] = await TransactionModel.aggregate([
      { $match: { userId, data: { $gte: inicioDoMes } } },
      {
        $group: {
          _id: "$tipo",
          total: { $sum: "$valor" },
        },
      },
    ]);

    return {
      receitas: totais?._id === "receita" ? totais.total : 0,
      despesas: totais?._id === "despesa" ? totais.total : 0,
    };
  },

  async getTotaisPorCategoria(userId: string) {
    return TransactionModel.aggregate([
      { $match: { userId, tipo: "despesa" } },
      { $group: { _id: "$categoria", total: { $sum: "$valor" } } },
      { $sort: { total: -1 } },
    ]);
  },

  async getComparativoPorPeriodo(userId: string, periodo: string) {
    // periodo: "mensal" | "ultimos-6-meses" | "ytd"
    return TransactionModel.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: { ano: { $year: "$data" }, mes: { $month: "$data" } },
          total: { $sum: "$valor" },
        },
      },
      { $sort: { "_id.ano": 1, "_id.mes": 1 } },
    ]);
  },
};
```
