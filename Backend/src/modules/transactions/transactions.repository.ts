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
    // as de uma conta: as lançadas nela e as transferências que chegaram a ela
    if (filtros.contaId) query.$and = [{ $or: [{ contaId: filtros.contaId }, { contaDestinoId: filtros.contaId }] }];
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
      (filtros.todos
        ? TransactionModel.find(query).sort({ data: -1, _id: -1 })
        : TransactionModel.find(query)
            .sort({ data: -1, _id: -1 })
            .skip((filtros.pagina - 1) * filtros.limite)
            .limit(filtros.limite)
      ).lean(),
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

  async create(
    dados: Omit<CreateTransactionDto, "parcelas" | "tipo" | "contaId"> & {
      contaId?: string;
      tipo: TransactionDocument["tipo"];
      userId: string;
      categoria: string;
      parcelas?: number;
      parcelamentoId?: string;
      contaDestinoId?: string;
    }
  ) {
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

  // ---- compras no crédito sem cartão (dados antigos) ----

  // As contas que têm compras no crédito sem cartão vinculado.
  async contasComCreditoSemCartao(userId: string): Promise<string[]> {
    return TransactionModel.distinct("contaId", { userId, formaPagamento: "credito", cartaoId: { $exists: false }, contaId: { $exists: true } });
  },

  async vincularCreditoSemCartao(userId: string, contaId: string, cartaoId: string) {
    const resultado = await TransactionModel.updateMany(
      { userId, contaId, formaPagamento: "credito", cartaoId: { $exists: false } },
      { $set: { cartaoId } }
    );
    return resultado.modifiedCount;
  },

  // ---- contas e transferências ----

  // Os movimentos que mexem no saldo das contas dadas: lançados nelas ou (transferências) recebidos por elas.
  async movimentosDasContas(userId: string, contaIds: string[]) {
    if (contaIds.length === 0) return [];
    return TransactionModel.find({ userId, $or: [{ contaId: { $in: contaIds } }, { contaDestinoId: { $in: contaIds } }] })
      .select("tipo valor contaId contaDestinoId")
      .lean();
  },

  // Excluir uma conta exclui os lançamentos dela (inclusive as transferências em que ela é origem ou destino). Devolve o que saiu, para o desfazer.
  async excluirDaConta(userId: string, contaId: string) {
    const filtro = { userId, $or: [{ contaId }, { contaDestinoId: contaId }] };
    const docs = await TransactionModel.find(filtro).lean();
    if (docs.length > 0) await TransactionModel.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    return docs;
  },

  // Desfazer: os lançamentos voltam com os mesmos ids.
  async restaurar(docs: unknown[]) {
    if (docs.length > 0) await TransactionModel.collection.insertMany(docs as never[]);
  },

  // Quantos lançamentos usam a conta (como origem ou como destino).
  async countByConta(userId: string, contaId: string) {
    return TransactionModel.countDocuments({ userId, $or: [{ contaId }, { contaDestinoId: contaId }] });
  },

  // Migração (RN10): lançamentos antigos, sem conta.
  async countSemConta(userId: string) {
    return TransactionModel.countDocuments({ userId, contaId: { $exists: false } });
  },

  async ligarSemContaA(userId: string, contaId: string, filtro: Record<string, unknown> = {}) {
    const resultado = await TransactionModel.updateMany({ userId, contaId: { $exists: false }, ...filtro }, { $set: { contaId } });
    return resultado.modifiedCount;
  },
};
