/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
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
  // só nas contas CREDIT: o limite do cartão e o dia do fechamento da fatura (de creditData), para criar o cartão ao conectar
  limite?: number;
  diaFechamento?: number;
}

export interface ConnectedAccountDocument {
  userId: string;
  pluggyItemId: string; // id do item na Pluggy (único: um item pertence a um só usuário)
  connectorId: number; // 2 = Pluggy Bank (sandbox)
  instituicao: string; // nome da instituição, para mostrar na tela
  status: string; // status do item na Pluggy: UPDATED, UPDATING, LOGIN_ERROR, OUTDATED...
  contas: ContaDaConexao[]; // resumo das contas da conexão na última sincronização
  ultimaSincronizacao?: Date;
  // O usuário excluiu a conta Open Finance desta conexão: a migração (RN10) não a recria sozinha. Voltar a criar a conta limpa a marca.
  contaDispensada?: boolean;
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
        limite: { type: Number },
        diaFechamento: { type: Number },
      },
    ],
    ultimaSincronizacao: { type: Date },
    contaDispensada: { type: Boolean },
  },
  { timestamps: true, collection: "connected_accounts" }
);

export const ConnectedAccountModel = model<ConnectedAccountDocument>("ConnectedAccount", ConnectedAccountSchema);
