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

    // `_id` desempata transações da mesma data, para a ordem (e as páginas) ficarem estáveis
    const [docs, total] = await Promise.all([
      TransactionModel.find(query)
        .sort({ data: -1, _id: -1 })
        .skip((filtros.pagina - 1) * filtros.limite)
        .limit(filtros.limite)
        .lean(),
      TransactionModel.countDocuments(query),
    ]);

    return { docs, total };
  },

  async create(dados: CreateTransactionDto & { userId: string; categoria: string }) {
    const transacao = await TransactionModel.create(dados);
    return transacao.toObject();
  },
};
