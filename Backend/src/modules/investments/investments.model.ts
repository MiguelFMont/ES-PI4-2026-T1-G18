// src/modules/investments/investments.model.ts
// Investimentos e cartão SIMULADOS do Grupo 5. Três coleções: o portfólio (investments), os cartões do usuário (cards, até
// MAX_CARTOES por usuário) e os parcelamentos dele (card_installments, cada um ligado a um cartão). Valores derivados
// (valor atual, parcela, saldo devedor, fatura) não são guardados: são calculados pelo Servidor Java a cada leitura.
import { CORES, ICONES } from "../../shared/aparencia/aparencia";
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

// Quantos cartões cada usuário pode ter.
export const MAX_CARTOES = 5;
// Nome do cartão criado sozinho quando o usuário ainda não tem nenhum.
export const NOME_CARTAO_PADRAO = "Cartão";

// Valores iniciais do cartão criado sozinho (e do cartão novo sem limite ou fechamento informados): a fatura fecha no dia 3 e vence 7 dias depois (dia 10).
export const CARTAO_PADRAO = { limite: 5000, diaFechamento: 3 } as const;

// A fatura vence sempre este número de dias depois do fechamento (simulação: o cartão guarda só o dia do fechamento).
export const DIAS_DO_FECHAMENTO_AO_VENCIMENTO = 7;

// Chave de comparação do nome: sem espaços nas pontas e sem diferenciar maiúsculas de minúsculas.
export const chaveDoNome = (nome: string) => nome.trim().toLocaleLowerCase("pt-BR");

// Um cartão de crédito simulado do usuário. O mais antigo (createdAt) é o "cartão padrão": recebe as compras no crédito
// que não indicam cartão (se o usuário não tem nenhum cartão, as compras no crédito simplesmente não entram em fatura).
export interface CardDocument {
  userId: string;
  nome: string;
  // nome em minúsculas: sustenta o índice único (nome único por usuário sem diferenciar maiúsculas)
  nomeChave: string;
  limite: number;
  // dia do mês em que a fatura fecha (1 a 28, para existir em todos os meses); o vencimento é 7 dias depois
  diaFechamento: number;
  // A conta (coleção accounts) a que o cartão está vinculado: obrigatória ao criar. Só faltam nos cartões antigos, de antes do vínculo.
  contaId?: string;
  // Cartões criados ao conectar o Open Finance: o id da conta CREDIT na Pluggy (evita criar o mesmo cartão duas vezes).
  pluggyAccountId?: string;
  // Aparência opcional (shared/aparencia): sem ela o Frontend mostra o logo do banco da conta.
  icone?: string | null; // null: sem ícone
  cor?: string | null;
}

const CardSchema = new Schema<CardDocument>(
  {
    userId: { type: String, required: true },
    nome: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    nomeChave: { type: String, required: true },
    limite: { type: Number, required: true, min: 0 },
    diaFechamento: { type: Number, required: true, min: 1, max: 28 },
    contaId: { type: String },
    pluggyAccountId: { type: String },
    icone: { type: String, enum: ICONES },
    cor: { type: String, enum: CORES },
  },
  { timestamps: true }
);
// Antes havia um índice único só por userId (um cartão por usuário): migrarCartoes() o remove nos bancos antigos.
CardSchema.index({ userId: 1, nomeChave: 1 }, { unique: true });

export interface InstallmentDocument {
  userId: string;
  // o cartão a que o parcelamento pertence; sem ele (dado antigo) vale o cartão mais antigo do usuário
  cartaoId?: string;
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
    cartaoId: { type: String },
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
