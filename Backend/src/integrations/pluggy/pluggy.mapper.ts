// src/integrations/pluggy/pluggy.mapper.ts
// Converte uma transação da Pluggy no que o FinanceAI grava. Regras (confirmadas no sandbox, ver a fixture):
// - receita ou despesa vem do SINAL do `amount` (negativo = despesa), nunca do `type`: no cartão de crédito
//   as compras vêm com type CREDIT e amount negativo;
// - o pagamento da fatura do cartão aparece na conta corrente e as compras já estão no cartão: contar os dois
//   dobraria o gasto, então ele é ignorado (é uma transferência);
// - só entram transações POSTED (as PENDING ainda podem mudar);
// - o `paymentData` (nome e CPF de terceiros) nunca é copiado.
import { FormaPagamento } from "../../modules/transactions/transactions.model";
import { normalizar } from "../../shared/utils/texto";
import { PluggyTransaction } from "./pluggy.types";

export interface TransacaoParaImportar {
  externalId: string; // o `id` da Pluggy: evita importar a mesma transação duas vezes
  tipo: "receita" | "despesa";
  valor: number;
  data: Date;
  descricao: string;
  formaPagamento: FormaPagamento;
}

export type MotivoIgnorada = "pendente" | "zerada" | "faturaCartao" | "invalida";

export type ResultadoMapeamento =
  | { ok: true; transacao: TransacaoParaImportar }
  | { ok: false; motivo: MotivoIgnorada };

const DESCRICAO_PADRAO = "Transação importada";

/** "PAGAMENTO FATURA CARTAO VISA": pagar a fatura é transferência entre a conta e o cartão, não um gasto. */
export function ehPagamentoDeFatura(descricao: string): boolean {
  const texto = ` ${normalizar(descricao)} `;
  return (texto.includes(" fatura ") && texto.includes(" cartao ")) || texto.includes(" pagamento fatura ");
}

function formaDePagamento(t: PluggyTransaction, tipoConta: string): FormaPagamento {
  const metodo = (t.paymentData?.paymentMethod ?? t.operationType ?? "").toUpperCase();
  if (metodo === "BOLETO") return "boleto";
  if (metodo === "PIX") return "pix";
  if (tipoConta === "CREDIT") return "credito";
  return "outro";
}

export function mapearTransacao(t: PluggyTransaction, tipoConta: string): ResultadoMapeamento {
  const data = new Date(t.date);
  if (!t.id || typeof t.amount !== "number" || !Number.isFinite(t.amount) || Number.isNaN(data.getTime())) {
    return { ok: false, motivo: "invalida" };
  }
  if (t.status && t.status !== "POSTED") return { ok: false, motivo: "pendente" };
  if (t.amount === 0) return { ok: false, motivo: "zerada" };

  const descricao = (t.description ?? "").trim() || DESCRICAO_PADRAO;
  if (ehPagamentoDeFatura(descricao)) return { ok: false, motivo: "faturaCartao" };

  return {
    ok: true,
    transacao: {
      externalId: t.id,
      tipo: t.amount < 0 ? "despesa" : "receita",
      valor: Math.round(Math.abs(t.amount) * 100) / 100,
      data,
      descricao,
      formaPagamento: formaDePagamento(t, tipoConta),
    },
  };
}
