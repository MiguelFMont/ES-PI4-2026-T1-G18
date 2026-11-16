// src/modules/investments/investments.model.ts
// Investimentos e cartão SIMULADOS do Grupo 5. Três coleções: o portfólio (investments), o cartão do usuário (cards) e
// os parcelamentos ativos dele (card_installments). Valores derivados (valor atual, parcela, saldo devedor, fatura) não
// são guardados: são calculados pelo Servidor Java a cada leitura.
import { Schema, model } from "mongoose";

export const TIPOS_DE_ATIVO = ["renda_fixa", "renda_variavel", "fundo", "cripto", "outro"] as const;
export type TipoDeAtivo = (typeof TIPOS_DE_ATIVO)[number];

export interface InvestmentDocument {
  userId: string;
  nome: string;
  tipo: TipoDeAtivo;
  valorInvestido: number;
  // rentabilidade simulada, em % ao mês (juros compostos)
  taxaMensal: number;
  // o rendimento conta os meses completos desde esta data
  dataAplicacao: Date;
}

const InvestmentSchema = new Schema<InvestmentDocument>(
  {
    userId: { type: String, required: true },
    nome: { type: String, required: true, trim: true, maxlength: 100 },
    tipo: { type: String, enum: TIPOS_DE_ATIVO, default: "outro" },
    valorInvestido: { type: Number, required: true, min: 0 },
    taxaMensal: { type: Number, default: 0 },
    dataAplicacao: { type: Date, required: true },
  },
  { timestamps: true }
);
InvestmentSchema.index({ userId: 1, createdAt: 1 });

// O cartão de crédito simulado do usuário (um por usuário, criado com valores padrão na primeira leitura).
export interface CardDocument {
  userId: string;
  limite: number;
  // dia do mês do vencimento da fatura (1 a 28, para existir em todos os meses)
  diaVencimento: number;
}

const CardSchema = new Schema<CardDocument>(
  {
    userId: { type: String, required: true, unique: true },
    limite: { type: Number, required: true, min: 0 },
    diaVencimento: { type: Number, required: true, min: 1, max: 28 },
  },
  { timestamps: true }
);

export interface InstallmentDocument {
  userId: string;
  descricao: string;
  valorTotal: number;
  parcelas: number;
  parcelasPagas: number;
  // juros do parcelamento, em % ao mês (0 = sem juros)
  taxaJurosMensal: number;
}

const InstallmentSchema = new Schema<InstallmentDocument>(
  {
    userId: { type: String, required: true },
    descricao: { type: String, required: true, trim: true, maxlength: 100 },
    valorTotal: { type: Number, required: true, min: 0 },
    parcelas: { type: Number, required: true, min: 1 },
    parcelasPagas: { type: Number, default: 0, min: 0 },
    taxaJurosMensal: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);
InstallmentSchema.index({ userId: 1, createdAt: 1 });

export const InvestmentModel = model<InvestmentDocument>("Investment", InvestmentSchema);
export const CardModel = model<CardDocument>("Card", CardSchema);
export const CardInstallmentModel = model<InstallmentDocument>("CardInstallment", InstallmentSchema, "card_installments");
