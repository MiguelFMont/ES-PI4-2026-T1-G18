// src/modules/connected-accounts/connected-accounts.model.ts
// Coleção `connected_accounts`: as conexões do usuário com instituições (Open Finance, sandbox da Pluggy).
// Uma conexão é um "item" da Pluggy; cada item tem uma ou mais contas (corrente, cartão...).
import { Schema, model } from "mongoose";

export interface ContaDaConexao {
  pluggyAccountId: string;
  tipo: string; // BANK ou CREDIT
  nome: string;
  saldo?: number;
  moeda?: string;
}

export interface ConnectedAccountDocument {
  userId: string;
  pluggyItemId: string; // id do item na Pluggy (único: um item pertence a um só usuário)
  connectorId: number; // 2 = Pluggy Bank (sandbox)
  instituicao: string; // nome da instituição, para mostrar na tela
  status: string; // status do item na Pluggy: UPDATED, UPDATING, LOGIN_ERROR, OUTDATED...
  contas: ContaDaConexao[]; // resumo das contas da conexão na última sincronização
  ultimaSincronizacao?: Date;
}

const ConnectedAccountSchema = new Schema<ConnectedAccountDocument>(
  {
    userId: { type: String, required: true, index: true },
    pluggyItemId: { type: String, required: true, unique: true },
    connectorId: { type: Number, required: true },
    instituicao: { type: String, required: true },
    status: { type: String, required: true },
    contas: [
      {
        _id: false,
        pluggyAccountId: { type: String, required: true },
        tipo: { type: String, required: true },
        nome: { type: String, required: true },
        saldo: { type: Number },
        moeda: { type: String },
      },
    ],
    ultimaSincronizacao: { type: Date },
  },
  { timestamps: true, collection: "connected_accounts" }
);

export const ConnectedAccountModel = model<ConnectedAccountDocument>("ConnectedAccount", ConnectedAccountSchema);
