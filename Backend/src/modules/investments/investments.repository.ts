// src/modules/investments/investments.repository.ts
import {
  CARTAO_PADRAO,
  CardDocument,
  CardInstallmentModel,
  CardModel,
  InstallmentDocument,
  InvestmentDocument,
  InvestmentModel,
  NOME_CARTAO_PADRAO,
  chaveDoNome,
} from "./investments.model";
import { TransactionModel } from "../transactions/transactions.model";

// Valores iniciais do cartão criado sozinho (continua exportado daqui para o seed).
export { CARTAO_PADRAO };

// Compras no crédito do período, somadas por cartão (`cartaoId` null = compras sem cartão indicado).
export interface ComprasDoCartao {
  cartaoId: string | null;
  total: number;
}

// Filtro dos parcelamentos de um cartão: o cartão mais antigo (padrão) também fica com os parcelamentos antigos, de
// antes de existir cartaoId.
const doCartao = (cartaoId: string, ehPadrao: boolean) =>
  ehPadrao ? { $or: [{ cartaoId }, { cartaoId: { $exists: false } }] } : { cartaoId };

// Tudo é filtrado por userId: nunca expor dado de um usuário para outro.
export const investmentsRepository = {
  // ---------------------------------------------------------------- portfólio
  async findInvestments(userId: string) {
    return InvestmentModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async createInvestment(dados: InvestmentDocument) {
    return (await InvestmentModel.create(dados)).toObject();
  },

  async removeInvestment(userId: string, id: string): Promise<boolean> {
    return (await InvestmentModel.deleteOne({ _id: id, userId })).deletedCount > 0;
  },

  // ---------------------------------------------------------------- cartões
  // Do mais antigo (o padrão) para o mais novo.
  async findCards(userId: string) {
    return CardModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async findCard(userId: string, id: string) {
    return CardModel.findOne({ _id: id, userId }).lean();
  },

  async countCards(userId: string): Promise<number> {
    return CardModel.countDocuments({ userId });
  },

  // O cartão do usuário com este nome (sem diferenciar maiúsculas), se houver; `exceto` ignora um cartão (na edição).
  async findCardByName(userId: string, nome: string, exceto?: string) {
    return CardModel.findOne({ userId, nomeChave: chaveDoNome(nome), ...(exceto && { _id: { $ne: exceto } }) }).lean();
  },

  // Quem não tem cartão recebe um chamado "Cartão", com os valores padrão (upsert atômico: duas chamadas juntas não criam
  // dois; a que perde a corrida cai no índice único e é ignorada).
  async ensureDefaultCard(userId: string): Promise<void> {
    if (await CardModel.exists({ userId })) return;
    try {
      await CardModel.updateOne(
        { userId, nomeChave: chaveDoNome(NOME_CARTAO_PADRAO) },
        { $setOnInsert: { nome: NOME_CARTAO_PADRAO, ...CARTAO_PADRAO } },
        { upsert: true }
      );
    } catch (erro: any) {
      if (erro?.code !== 11000) throw erro;
    }
  },

  // O cartão mais antigo (cria o padrão se o usuário não tem nenhum).
  async findOldestCard(userId: string) {
    await investmentsRepository.ensureDefaultCard(userId);
    return CardModel.findOne({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async createCard(dados: Pick<CardDocument, "userId" | "nome" | "limite" | "diaVencimento">) {
    return (await CardModel.create({ ...dados, nomeChave: chaveDoNome(dados.nome) })).toObject();
  },

  async updateCard(userId: string, id: string, alteracoes: Partial<Pick<CardDocument, "nome" | "limite" | "diaVencimento">>) {
    const { nome, ...resto } = alteracoes;
    const set = { ...resto, ...(nome !== undefined && { nome: nome.trim(), nomeChave: chaveDoNome(nome) }) };
    return CardModel.findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true, runValidators: true }).lean();
  },

  // Quantos parcelamentos do cartão ainda não foram quitados (isso impede a exclusão do cartão).
  async countActiveInstallments(userId: string, cartaoId: string, ehPadrao: boolean): Promise<number> {
    return CardInstallmentModel.countDocuments({
      userId,
      $expr: { $lt: ["$parcelasPagas", "$parcelas"] },
      ...doCartao(cartaoId, ehPadrao),
    });
  },

  // Exclui o cartão. Sem parcelamentos ativos (quem chama já conferiu), os quitados saem junto e as transações que
  // apontavam para o cartão são desvinculadas: perdem o cartão e o parcelamento (a compra parcelada vira uma compra
  // comum, parcelas = 1) e passam a contar para o cartão mais antigo que sobrar.
  async removeCard(userId: string, cartaoId: string, ehPadrao: boolean): Promise<boolean> {
    const { deletedCount } = await CardModel.deleteOne({ _id: cartaoId, userId });
    if (deletedCount === 0) return false;
    await CardInstallmentModel.deleteMany({ userId, ...doCartao(cartaoId, ehPadrao) });
    await TransactionModel.updateMany(
      { userId, cartaoId, parcelamentoId: { $exists: true } },
      { $unset: { cartaoId: "", parcelamentoId: "" }, $set: { parcelas: 1 } }
    );
    await TransactionModel.updateMany({ userId, cartaoId }, { $unset: { cartaoId: "" } });
    return true;
  },

  // Despesas reais pagas no crédito no período [de, ate], somadas por cartão: a parte "compras" das faturas. As compras
  // PARCELADAS (com parcelamentoId) ficam de fora: a fatura conta as parcelas do parcelamento, nunca as duas coisas. Só
  // lê a coleção do Grupo 2, nunca altera.
  async somarComprasNoCredito(userId: string, de: Date, ate: Date): Promise<ComprasDoCartao[]> {
    const grupos = await TransactionModel.aggregate<{ _id: string | null; total: number }>([
      {
        $match: {
          userId,
          tipo: "despesa",
          formaPagamento: "credito",
          parcelamentoId: { $exists: false },
          data: { $gte: de, $lte: ate },
        },
      },
      { $group: { _id: "$cartaoId", total: { $sum: "$valor" } } },
    ]);
    return grupos.map((g) => ({ cartaoId: g._id ?? null, total: g.total }));
  },

  // ---------------------------------------------------------------- parcelamentos
  async findInstallments(userId: string) {
    return CardInstallmentModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async findInstallment(userId: string, id: string) {
    return CardInstallmentModel.findOne({ _id: id, userId }).lean();
  },

  async findInstallmentsByIds(userId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return CardInstallmentModel.find({ userId, _id: { $in: ids } }).lean();
  },

  async createInstallment(dados: InstallmentDocument) {
    return (await CardInstallmentModel.create(dados)).toObject();
  },

  async updateInstallment(userId: string, id: string, alteracoes: Partial<InstallmentDocument>) {
    return CardInstallmentModel.findOneAndUpdate({ _id: id, userId }, { $set: alteracoes }, { new: true, runValidators: true }).lean();
  },

  async removeInstallment(userId: string, id: string): Promise<boolean> {
    return (await CardInstallmentModel.deleteOne({ _id: id, userId })).deletedCount > 0;
  },

  async removeInstallments(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return (await CardInstallmentModel.deleteMany({ _id: { $in: ids }, userId })).deletedCount;
  },

  // De cada parcelamento (dos ids pedidos) que nasceu de uma compra: o id da transação.
  async transacoesDosParcelamentos(userId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const docs = await TransactionModel.find({ userId, parcelamentoId: { $in: ids } }).select("parcelamentoId").lean();
    return new Map(docs.map((d) => [d.parcelamentoId as string, d._id.toString()]));
  },

  // De cada parcelamento (dos ids pedidos) que nasceu de uma compra: a data da compra (de onde as parcelas começam a correr).
  async datasDasCompras(userId: string, ids: string[]): Promise<Map<string, Date>> {
    if (ids.length === 0) return new Map();
    const docs = await TransactionModel.find({ userId, parcelamentoId: { $in: ids } }).select("parcelamentoId data").lean();
    return new Map(docs.map((d) => [d.parcelamentoId as string, d.data as Date]));
  },

  // ---------------------------------------------------------------- migração
  // Idempotente; roda quando o Backend sobe (server.ts). Traz os dados do tempo de "um cartão por usuário":
  //  1. remove o índice único antigo por userId (impediria o segundo cartão);
  //  2. dá o nome padrão aos cartões antigos (sem nome): cada usuário continua com o seu cartão, com o mesmo limite e
  //     vencimento, agora chamado "Cartão";
  //  3. liga ao cartão mais antigo do usuário os parcelamentos antigos (sem cartaoId).
  // As transações antigas em crédito não mudam: sem cartaoId, contam para o cartão mais antigo, como antes.
  async migrarCartoes(): Promise<void> {
    const indices = await CardModel.collection.indexes().catch(() => []);
    if (indices.some((i) => i.name === "userId_1" && i.unique)) {
      await CardModel.collection.dropIndex("userId_1");
    }
    await CardModel.updateMany(
      { nome: { $exists: false } },
      { $set: { nome: NOME_CARTAO_PADRAO, nomeChave: chaveDoNome(NOME_CARTAO_PADRAO) } }
    );
    await CardModel.createIndexes();

    const donos: string[] = await CardInstallmentModel.distinct("userId", { cartaoId: { $exists: false } });
    for (const userId of donos) {
      const maisAntigo = await investmentsRepository.findOldestCard(userId);
      if (maisAntigo) {
        await CardInstallmentModel.updateMany(
          { userId, cartaoId: { $exists: false } },
          { $set: { cartaoId: maisAntigo._id.toString() } }
        );
      }
    }
  },
};
