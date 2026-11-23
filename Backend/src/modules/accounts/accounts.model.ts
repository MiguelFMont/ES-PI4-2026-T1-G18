// src/modules/accounts/accounts.model.ts
// Coleção `accounts`: as contas do usuário (especificação de contas e transferências, seção 3).
// O saldo atual NUNCA é gravado: é calculado pelo Servidor Java a partir do saldoInicial e dos movimentos (RN9).
import { Schema, model } from "mongoose";
import { CORES, ICONES } from "../../shared/aparencia/aparencia";

// Lista fixa de bancos do campo Banco (RN1). O código é o que fica gravado; o nome é o que a tela mostra.
export const BANCOS = [
  { codigo: "bb", nome: "Banco do Brasil" },
  { codigo: "bradesco", nome: "Bradesco" },
  { codigo: "c6", nome: "C6 Bank" },
  { codigo: "caixa", nome: "Caixa" },
  { codigo: "inter", nome: "Inter" },
  { codigo: "itau", nome: "Itaú" },
  { codigo: "nubank", nome: "Nubank" },
  { codigo: "santander", nome: "Santander" },
  { codigo: "btg", nome: "BTG Pactual" },
  { codigo: "outro", nome: "Outro" },
] as const;

export const CODIGOS_BANCOS = BANCOS.map((b) => b.codigo) as [string, ...string[]];
export const nomeDoBanco = (codigo: string) => BANCOS.find((b) => b.codigo === codigo)?.nome ?? "Outro";

export const TIPOS_CONTA = ["manual", "open_finance"] as const;
export type TipoConta = (typeof TIPOS_CONTA)[number];

export interface AccountDocument {
  userId: string;
  nome: string; // 1 a 40 caracteres
  nomeChave: string; // o nome em minúsculas: garante um nome único por usuário sem diferenciar maiúsculas
  banco: string; // código da lista BANCOS
  tipo: TipoConta;
  saldoInicial: number;
  // Só em contas open_finance: o id da conexão em `connected_accounts` de onde vem o saldo.
  conectadaId?: string;
  // Aparência opcional (shared/aparencia): sem ela o Frontend mostra o logo do banco.
  icone?: string | null; // null: sem ícone
  cor?: string | null;
}

const AccountSchema = new Schema<AccountDocument>(
  {
    userId: { type: String, required: true, index: true },
    nome: { type: String, required: true, maxlength: 40 },
    nomeChave: { type: String, required: true },
    banco: { type: String, enum: CODIGOS_BANCOS, required: true },
    tipo: { type: String, enum: TIPOS_CONTA, required: true },
    saldoInicial: { type: Number, required: true, default: 0 },
    conectadaId: { type: String },
    icone: { type: String, enum: ICONES },
    cor: { type: String, enum: CORES },
  },
  { timestamps: true, collection: "accounts" }
);

// Nome único por usuário (sem diferenciar maiúsculas) e uma conta open_finance por conexão.
AccountSchema.index({ userId: 1, nomeChave: 1 }, { unique: true });
AccountSchema.index(
  { userId: 1, conectadaId: 1 },
  { unique: true, partialFilterExpression: { conectadaId: { $type: "string" } } }
);

export const AccountModel = model<AccountDocument>("Account", AccountSchema);
