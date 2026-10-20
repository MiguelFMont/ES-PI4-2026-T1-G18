// src/modules/transactions/transactions.repository.ts
import { TransactionModel } from "./transactions.model";
import { CreateTransactionDto, TransactionFiltersDto } from "./transactions.dto";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// O texto digitado na busca vira trecho literal: um "." ou "(" digitado não é padrão de busca.
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const transactionsRepository = {
  // Sempre filtrada por userId: nunca expor transação de um usuário para outro.
  async findByUser(userId: string, filtros: TransactionFiltersDto) {
    const query: Record<string, unknown> = { userId };

    if (filtros.tipo) query.tipo = filtros.tipo;
    if (filtros.categoria) query.categoria = filtros.categoria;
    if (filtros.formaPagamento) query.formaPagamento = filtros.formaPagamento;
    if (filtros.origem) query.origem = filtros.origem;
    if (filtros.busca) query.descricao = { $regex: escaparRegex(filtros.busca), $options: "i" };

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
    const [docs, total, agrupado] = await Promise.all([
      TransactionModel.find(query)
        .sort({ data: -1, _id: -1 })
        .skip((filtros.pagina - 1) * filtros.limite)
        .limit(filtros.limite)
        .lean(),
      TransactionModel.countDocuments(query),
      // soma por tipo de tudo o que passa nos filtros (não só da página), para o resumo do extrato
      TransactionModel.aggregate<{ _id: string; total: number }>([
        { $match: query },
        { $group: { _id: "$tipo", total: { $sum: "$valor" } } },
      ]),
    ]);

    const soma = (tipo: string) => agrupado.find((g) => g._id === tipo)?.total ?? 0;
    return { docs, total, totais: { receitas: soma("receita"), despesas: soma("despesa") } };
  },

  async create(dados: CreateTransactionDto & { userId: string; categoria: string }) {
    const transacao = await TransactionModel.create(dados);
    return transacao.toObject();
  },
};
