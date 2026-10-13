// src/modules/transactions/transactions.repository.ts
import { TransactionModel } from "./transactions.model";
import { CreateTransactionDto, TransactionFiltersDto } from "./transactions.dto";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export const transactionsRepository = {
  // Sempre filtrada por userId: nunca expor transação de um usuário para outro.
  async findByUser(userId: string, filtros: TransactionFiltersDto) {
    const query: Record<string, unknown> = { userId };

    if (filtros.categoria) query.categoria = filtros.categoria;
    if (filtros.origem) query.origem = filtros.origem;

    if (filtros.dataInicio || filtros.dataFim) {
      // dataFim sem horário (meia-noite) vale até o fim daquele dia
      const fim =
        filtros.dataFim && filtros.dataFim.getTime() % UM_DIA_MS === 0
          ? new Date(filtros.dataFim.getTime() + UM_DIA_MS - 1)
          : filtros.dataFim;

      query.data = {
        ...(filtros.dataInicio && { $gte: filtros.dataInicio }),
        ...(fim && { $lte: fim }),
      };
    }

    if (filtros.valorMin !== undefined || filtros.valorMax !== undefined) {
      query.valor = {
        ...(filtros.valorMin !== undefined && { $gte: filtros.valorMin }),
        ...(filtros.valorMax !== undefined && { $lte: filtros.valorMax }),
      };
    }

    return TransactionModel.find(query).sort({ data: -1 }).lean();
  },

  async create(dados: CreateTransactionDto & { userId: string; categoria: string }) {
    const transacao = await TransactionModel.create(dados);
    return transacao.toObject();
  },
};
