# transactions.repository.ts — Acesso a dados de transações

## O que deve ter neste arquivo
- Consultas sempre filtradas por `userId` (nunca expor transação de um usuário para outro).
- `findByUser` monta o filtro do Mongo a partir dos filtros de categoria/período/valor/origem recebidos.
- CRUD puro, sem decidir regra de categorização isso é do `transactions.service.ts`.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.repository.ts
import { TransactionModel } from "./transactions.model";
import { CreateTransactionDto, TransactionFiltersDto } from "./transactions.dto";

export const transactionsRepository = {
  async findByUser(userId: string, filtros: TransactionFiltersDto) {
    const query: Record<string, unknown> = { userId };

    if (filtros.categoria) query.categoria = filtros.categoria;
    if (filtros.origem) query.origem = filtros.origem;
    if (filtros.dataInicio || filtros.dataFim) {
      query.data = {
        ...(filtros.dataInicio && { $gte: filtros.dataInicio }),
        ...(filtros.dataFim && { $lte: filtros.dataFim }),
      };
    }

    return TransactionModel.find(query).sort({ data: -1 }).lean();
  },

  // as N transações mais recentes (usado para montar o contexto do Mentor IA)
  async findRecentByUser(userId: string, limite: number) {
    return TransactionModel.find({ userId }).sort({ data: -1 }).limit(limite).lean();
  },

  async findByIdAndUser(userId: string, id: string) {
    return TransactionModel.findOne({ _id: id, userId }).lean();
  },

  async create(dados: CreateTransactionDto & { userId: string }) {
    const transacao = await TransactionModel.create(dados);
    return transacao.toObject();
  },

  async updateByUser(userId: string, id: string, dados: Partial<CreateTransactionDto>) {
    return TransactionModel.findOneAndUpdate({ _id: id, userId }, dados, { new: true }).lean();
  },

  async deleteByUser(userId: string, id: string) {
    return TransactionModel.deleteOne({ _id: id, userId });
  },
};
```
