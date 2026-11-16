// src/modules/investments/investments.repository.ts
import {
  CardDocument,
  CardInstallmentModel,
  CardModel,
  InstallmentDocument,
  InvestmentDocument,
  InvestmentModel,
} from "./investments.model";
import { TransactionModel } from "../transactions/transactions.model";

// Valores iniciais do cartão simulado, criado na primeira leitura.
export const CARTAO_PADRAO = { limite: 5000, diaVencimento: 10 } as const;

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

  // ---------------------------------------------------------------- cartão
  // O cartão nasce com os valores padrão na primeira leitura (upsert atômico: duas leituras juntas não criam dois).
  async findOrCreateCard(userId: string) {
    return CardModel.findOneAndUpdate({ userId }, { $setOnInsert: CARTAO_PADRAO }, { upsert: true, new: true }).lean();
  },

  // Garante que o cartão existe (com os valores padrão) e então aplica só as alterações pedidas.
  async updateCard(userId: string, alteracoes: Partial<CardDocument>) {
    await investmentsRepository.findOrCreateCard(userId);
    return CardModel.findOneAndUpdate({ userId }, { $set: alteracoes }, { new: true, runValidators: true }).lean();
  },

  // Despesas reais pagas com cartão de crédito no período [de, ate]: a parte "compras" da fatura. Só lê a coleção do
  // Grupo 2, nunca altera.
  async somarComprasNoCredito(userId: string, de: Date, ate: Date): Promise<number> {
    const [grupo] = await TransactionModel.aggregate<{ total: number }>([
      { $match: { userId, tipo: "despesa", formaPagamento: "credito", data: { $gte: de, $lte: ate } } },
      { $group: { _id: null, total: { $sum: "$valor" } } },
    ]);
    return grupo?.total ?? 0;
  },

  // ---------------------------------------------------------------- parcelamentos
  async findInstallments(userId: string) {
    return CardInstallmentModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async findInstallment(userId: string, id: string) {
    return CardInstallmentModel.findOne({ _id: id, userId }).lean();
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
};
