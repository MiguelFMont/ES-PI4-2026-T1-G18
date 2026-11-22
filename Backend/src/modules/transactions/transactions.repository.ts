// src/modules/transactions/transactions.repository.ts
import { TransactionDocument, TransactionModel } from "./transactions.model";
import { CreateTransactionDto, TransactionFiltersDto, UpdateTransactionDto } from "./transactions.dto";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// O que o service entrega ao repository na edição em lote: as alterações do usuário mais os campos do cartão que o próprio
// service calcula (`null` apaga o campo; `parcelamentoId` nunca vem do usuário).
export type AtualizacaoDeTransacao = Omit<UpdateTransactionDto, "parcelas"> & {
  parcelas?: number | null;
  parcelamentoId?: string | null;
};

// Converte as alterações de uma transação (edição em lote) em operadores do Mongo. `observacoes: ""` e `null` (metaId,
// cartaoId, parcelas, parcelamentoId) apagam o campo ($unset); sem isso o Mongoose ignoraria o valor vazio e o antigo ficaria.
function montarAtualizacao(dados: AtualizacaoDeTransacao) {
  const { observacoes, metaId, cartaoId, parcelas, parcelamentoId, ...resto } = dados;
  const set: Record<string, unknown> = { ...resto };
  const unset: Record<string, ""> = {};
  const anulaveis = { cartaoId, parcelas, parcelamentoId };
  for (const [campo, valor] of Object.entries(anulaveis)) {
    if (valor === undefined) continue;
    if (valor === null) unset[campo] = "";
    else set[campo] = valor;
  }
  if (observacoes !== undefined) {
    if (observacoes === "") unset.observacoes = "";
    else set.observacoes = observacoes;
  }
  if (metaId !== undefined) {
    if (metaId === null) unset.metaId = "";
    else set.metaId = metaId;
  }
  const atualizacao: Record<string, unknown> = {};
  if (Object.keys(unset).length > 0) atualizacao.$unset = unset;
  if (Object.keys(set).length > 0) atualizacao.$set = set;
  return atualizacao;
}

// O texto digitado na busca vira trecho literal: um "." ou "(" digitado não é padrão de busca.
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const transactionsRepository = {
  // Sempre filtrada por userId: nunca expor transação de um usuário para outro.
  // `cartaoPadrao`: o cartão de `filtros.cartaoId` é o mais antigo do usuário, que também recebe as compras no crédito sem cartão.
  async findByUser(userId: string, filtros: TransactionFiltersDto, { cartaoPadrao = false }: { cartaoPadrao?: boolean } = {}) {
    const query: Record<string, unknown> = { userId };

    if (filtros.tipo) query.tipo = filtros.tipo;
    if (filtros.categoria) query.categoria = filtros.categoria;
    if (filtros.formaPagamento) query.formaPagamento = filtros.formaPagamento;
    if (filtros.origem) query.origem = filtros.origem;
    if (filtros.metaId) query.metaId = filtros.metaId === "nenhuma" ? { $exists: false } : filtros.metaId;
    if (filtros.busca) query.descricao = { $regex: escaparRegex(filtros.busca), $options: "i" };
    if (filtros.cartaoId) {
      // as compras de um cartão: despesas no crédito feitas nele (e, no cartão padrão, as sem cartão, igual à fatura)
      query.tipo = "despesa";
      query.formaPagamento = "credito";
      query.$or = cartaoPadrao ? [{ cartaoId: filtros.cartaoId }, { cartaoId: { $exists: false } }] : [{ cartaoId: filtros.cartaoId }];
    }

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

  // Todas as transações do usuário desde `dataInicio`, só com os campos do resumo do Mentor IA. Sem paginação: o Servidor
  // Java soma a lista inteira (totais, categorias, maiores despesas), então qualquer transação que faltasse deixaria os
  // números do resumo errados. O tamanho do prompt não cresce com a lista: o Java devolve sempre um resumo curto.
  async findParaResumo(userId: string, dataInicio: Date) {
    return TransactionModel.find({ userId, data: { $gte: dataInicio } })
      .select({ _id: 0, tipo: 1, valor: 1, categoria: 1, descricao: 1, data: 1 })
      .sort({ data: -1, _id: -1 })
      .lean();
  },

  async create(dados: Omit<CreateTransactionDto, "parcelas"> & { userId: string; categoria: string; parcelas?: number; parcelamentoId?: string }) {
    const transacao = await TransactionModel.create(dados);
    return transacao.toObject();
  },

  // Uma transação do usuário (ou null se não existe ou é de outro usuário).
  async findOneByUser(userId: string, id: string) {
    return TransactionModel.findOne({ _id: id, userId }).lean();
  },

  // As transações do usuário com os ids pedidos (as que não existem, ou são de outro usuário, não vêm).
  async findManyByUser(userId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return TransactionModel.find({ _id: { $in: ids }, userId }).lean();
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

  async updateMany(userId: string, itens: { id: string; alteracoes: AtualizacaoDeTransacao }[]) {
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
