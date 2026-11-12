// src/modules/transactions/transactions.repository.ts
import { TransactionDocument, TransactionModel } from "./transactions.model";
import { CreateTransactionDto, TransactionFiltersDto, UpdateTransactionDto } from "./transactions.dto";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// Converte as alterações de uma transação (edição em lote) em operadores do Mongo. `observacoes: ""` apaga o campo ($unset); sem isso o
// Mongoose ignoraria o undefined e a observação antiga ficaria.
function montarAtualizacao(dados: UpdateTransactionDto) {
  const { observacoes, ...resto } = dados;
  const set: Record<string, unknown> = { ...resto };
  const atualizacao: Record<string, unknown> = {};
  if (observacoes !== undefined) {
    if (observacoes === "") atualizacao.$unset = { observacoes: "" };
    else set.observacoes = observacoes;
  }
  if (Object.keys(set).length > 0) atualizacao.$set = set;
  return atualizacao;
}

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

  // Dos ids pedidos, os que existem e são do usuário (o resto é "não encontrada").
  async idsDoUsuario(userId: string, ids: string[]) {
    const docs = await TransactionModel.find({ _id: { $in: ids }, userId }).select("_id").lean();
    return new Set(docs.map((d) => d._id.toString()));
  },

  // Cada transação recebe as suas alterações; o filtro com o userId garante que só o dono altera.
  // Dos ids da Pluggy pedidos, os que o usuário já importou.
  async externalIdsExistentes(userId: string, ids: string[]) {
    if (ids.length === 0) return new Set<string>();
    const docs = await TransactionModel.find({ userId, externalId: { $in: ids } }).select("externalId").lean();
    return new Set(docs.map((d) => d.externalId as string));
  },

  // Insere as importadas sem parar no primeiro duplicado (uma sincronização concorrente pode ter inserido antes).
  async inserirImportadas(docs: TransactionDocument[]): Promise<number> {
    if (docs.length === 0) return 0;
    try {
      const inseridas = await TransactionModel.insertMany(docs, { ordered: false });
      return inseridas.length;
    } catch (erro: any) {
      const duplicadas = erro?.writeErrors?.every?.((e: any) => e?.err?.code === 11000 || e?.code === 11000);
      if (!duplicadas) throw erro;
      return erro.insertedDocs?.length ?? erro.result?.insertedCount ?? 0;
    }
  },

  async updateMany(userId: string, itens: { id: string; alteracoes: UpdateTransactionDto }[]) {
    if (itens.length === 0) return 0;
    const resultado = await TransactionModel.bulkWrite(
      itens.map(({ id, alteracoes }) => ({
        updateOne: { filter: { _id: id, userId }, update: montarAtualizacao(alteracoes) },
      }))
    );
    return resultado.matchedCount;
  },

  async removeMany(userId: string, ids: string[]) {
    if (ids.length === 0) return 0;
    const resultado = await TransactionModel.deleteMany({ _id: { $in: ids }, userId });
    return resultado.deletedCount;
  },
};
