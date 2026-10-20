// src/modules/transactions/transactions.dto.ts
import { z } from "zod";
import { FORMAS_PAGAMENTO, FormaPagamento } from "./transactions.model";

export const createTransactionSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  valor: z.number().positive(),
  categoria: z.string().trim().min(1).optional(),
  data: z.coerce.date(),
  descricao: z.string().trim().min(1),
  // em branco vira "sem observação"
  observacoes: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((texto) => texto || undefined),
  formaPagamento: z.enum(FORMAS_PAGAMENTO).default("outro"),
  origem: z.enum(["manual", "pluggy"]).default("manual"),
});

export const transactionFiltersSchema = z
  .object({
    tipo: z.enum(["receita", "despesa"]).optional(),
    categoria: z.string().optional(),
    formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
    origem: z.enum(["manual", "pluggy"]).optional(),
    busca: z.string().trim().min(1).max(100).optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    valorMin: z.coerce.number().min(0).optional(),
    valorMax: z.coerce.number().min(0).optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((f) => !f.dataInicio || !f.dataFim || f.dataInicio <= f.dataFim, {
    message: "dataInicio não pode ser depois de dataFim",
    path: ["dataInicio"],
  })
  .refine((f) => f.valorMin === undefined || f.valorMax === undefined || f.valorMin <= f.valorMax, {
    message: "valorMin não pode ser maior que valorMax",
    path: ["valorMin"],
  });

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
export type TransactionFiltersDto = z.infer<typeof transactionFiltersSchema>;

// O que o Frontend recebe: `id` no lugar de `_id`, sem `userId` nem campos internos do Mongo.
export interface TransactionResponseDto {
  id: string;
  tipo: "receita" | "despesa";
  valor: number;
  categoria: string;
  data: string; // ISO 8601
  descricao: string;
  observacoes?: string; // só aparece quando foi informada
  formaPagamento: FormaPagamento;
  origem: "manual" | "pluggy";
}

// Entradas, saídas e saldo de TODAS as transações que passam nos filtros (não só da página).
export interface TransactionSummaryDto {
  receitas: number;
  despesas: number;
  saldo: number; // receitas - despesas
}

// Resposta da listagem: uma página de transações, o resumo do extrato e os dados da paginação.
export interface TransactionListResponseDto {
  itens: TransactionResponseDto[];
  pagina: number; // página devolvida (começa em 1)
  limite: number; // itens por página
  total: number; // total de transações que passam nos filtros (todas as páginas)
  totalPaginas: number; // 0 quando não há nenhuma transação
  resumo: TransactionSummaryDto;
}
