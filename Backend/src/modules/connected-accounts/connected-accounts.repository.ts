// src/modules/connected-accounts/connected-accounts.repository.ts
// Único acesso ao banco para a coleção `connected_accounts`. Todo acesso filtra por userId.
import { ConnectedAccountDocument, ConnectedAccountModel } from "./connected-accounts.model";

export const connectedAccountsRepository = {
  async create(dados: ConnectedAccountDocument) {
    const conta = await ConnectedAccountModel.create(dados);
    return conta.toObject();
  },

  async findByUser(userId: string) {
    return ConnectedAccountModel.find({ userId }).sort({ createdAt: -1 }).lean();
  },

  async countByUser(userId: string) {
    return ConnectedAccountModel.countDocuments({ userId });
  },

  async findOne(userId: string, id: string) {
    return ConnectedAccountModel.findOne({ _id: id, userId }).lean();
  },

  // Em qualquer usuário: serve para saber se um item da Pluggy já está ligado a alguém.
  async findByItemId(pluggyItemId: string) {
    return ConnectedAccountModel.findOne({ pluggyItemId }).lean();
  },

  async update(userId: string, id: string, dados: Partial<ConnectedAccountDocument>) {
    return ConnectedAccountModel.findOneAndUpdate({ _id: id, userId }, { $set: dados }, { new: true }).lean();
  },

  async remove(userId: string, id: string) {
    return ConnectedAccountModel.findOneAndDelete({ _id: id, userId }).lean();
  },
};
