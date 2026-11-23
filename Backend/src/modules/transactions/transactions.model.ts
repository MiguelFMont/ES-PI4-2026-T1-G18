// src/modules/transactions/transactions.model.ts
import { Schema, model } from "mongoose";

// Valores aceitos em formaPagamento (a API e o banco usam esta mesma lista).
export const FORMAS_PAGAMENTO = ["dinheiro", "pix", "debito", "credito", "boleto", "outro"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export interface TransactionDocument {
  userId: string;
  // "transferencia": move um valor da conta contaId para a conta contaDestinoId; não é receita nem despesa (RN6)
  tipo: "receita" | "despesa" | "transferencia";
  valor: number;
  categoria: string;
  data: Date;
  descricao: string;
  observacoes?: string;
  formaPagamento: FormaPagamento;
  origem: "manual" | "pluggy";
  // A conta (coleção accounts) do lançamento. Obrigatório nos manuais; nos importados da Pluggy é a conta Open Finance de
  // onde vieram. Só falta nos lançamentos antigos, que a migração (RN10) liga à "Conta principal".
  contaId?: string;
  // Só em tipo "transferencia": a conta de destino (a de origem fica em contaId).
  contaDestinoId?: string;
  // Só para origem "pluggy": o id da transação na Pluggy (evita importar duas vezes) e a conta conectada de onde veio.
  externalId?: string;
  contaConectadaId?: string;
  // A meta (Grupo 5) a que esta transação foi vinculada: o valor dela conta como aporte no progresso da meta. Opcional.
  metaId?: string;
  // Cartão de crédito (seção 6 do contrato) a que a compra pertence. Só com formaPagamento "credito"; sem ele, a compra
  // conta para o cartão mais antigo do usuário.
  cartaoId?: string;
  // Número de parcelas da compra no crédito (1 a 24). Ausente = 1.
  parcelas?: number;
  // O parcelamento (card_installments) criado por esta compra quando parcelas > 1. Com ele a compra NÃO entra na fatura
  // como compra à vista: a fatura conta as parcelas do parcelamento.
  parcelamentoId?: string;
}

const TransactionSchema = new Schema<TransactionDocument>(
  {
    userId: { type: String, required: true, index: true },
    tipo: { type: String, enum: ["receita", "despesa", "transferencia"], required: true },
    valor: { type: Number, required: true },
    categoria: { type: String, required: true },
    data: { type: Date, required: true },
    descricao: { type: String, required: true },
    observacoes: { type: String, maxlength: 300 },
    formaPagamento: { type: String, enum: FORMAS_PAGAMENTO, default: "outro" },
    origem: { type: String, enum: ["manual", "pluggy"], default: "manual" },
    externalId: { type: String },
    contaId: { type: String },
    contaDestinoId: { type: String },
    contaConectadaId: { type: String, index: true },
    metaId: { type: String },
    cartaoId: { type: String },
    parcelas: { type: Number, min: 1, max: 24 },
    parcelamentoId: { type: String },
  },
  { timestamps: true }
);

// ajuda a listagem (mais recentes primeiro) e o painel
TransactionSchema.index({ userId: 1, data: -1 });
// o progresso de cada meta soma as transações vinculadas a ela
TransactionSchema.index({ userId: 1, metaId: 1 });

// o saldo e a listagem por conta
TransactionSchema.index({ userId: 1, contaId: 1 });
TransactionSchema.index({ userId: 1, contaDestinoId: 1 }, { sparse: true });

// a fatura de cada cartão soma as compras no crédito ligadas a ele
TransactionSchema.index({ userId: 1, cartaoId: 1 });

// A mesma transação da Pluggy não entra duas vezes para o mesmo usuário. Parcial: as manuais não têm externalId.
TransactionSchema.index(
  { userId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: "string" } } }
);

export const TransactionModel = model<TransactionDocument>("Transaction", TransactionSchema);
