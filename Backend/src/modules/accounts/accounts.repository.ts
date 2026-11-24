/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/accounts/accounts.repository.ts
// Único acesso ao banco para a coleção `accounts`. Todo acesso filtra por userId.
import { AccountDocument, AccountModel } from "./accounts.model";

export const accountsRepository = {
  async create(dados: AccountDocument) {
    const conta = await AccountModel.create(dados);
    return conta.toObject();
  },

  async findByUser(userId: string) {
    return AccountModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async countByUser(userId: string) {
    return AccountModel.countDocuments({ userId });
  },

  async findOne(userId: string, id: string) {
    return AccountModel.findOne({ _id: id, userId }).lean();
  },

  async findByNomeChave(userId: string, nomeChave: string) {
    return AccountModel.findOne({ userId, nomeChave }).lean();
  },

  async findByConectada(userId: string, conectadaId: string) {
    return AccountModel.findOne({ userId, conectadaId }).lean();
  },

  async update(userId: string, id: string, dados: Partial<AccountDocument>) {
    return AccountModel.findOneAndUpdate({ _id: id, userId }, { $set: dados }, { new: true }).lean();
  },

  // A conexão Open Finance acabou: a conta vira manual (sem `conectadaId`) com o saldo inicial recalculado.
  async converterParaManual(userId: string, id: string, saldoInicial: number) {
    return AccountModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { tipo: "manual", saldoInicial }, $unset: { conectadaId: "" } },
      { new: true }
    ).lean();
  },

  async remove(userId: string, id: string) {
    return AccountModel.findOneAndDelete({ _id: id, userId }).lean();
  },

  // Desfazer a exclusão: a conta volta com o mesmo id (a coleção nativa mantém o _id e as datas).
  async restaurar(conta: unknown) {
    await AccountModel.collection.insertOne(conta as never);
  },
};
