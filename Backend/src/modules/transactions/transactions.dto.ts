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

// Alterações de UMA transação na edição em lote: parcial (só o que muda), sem valores padrão e sem `origem`.
export const updateTransactionSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  valor: z.number().positive(),
  categoria: z.string().trim().min(1),
  data: z.coerce.date(),
  descricao: z.string().trim().min(1),
  observacoes: z.string().trim().max(300), // "" = apagar; sem transform
  formaPagamento: z.enum(FORMAS_PAGAMENTO), // sem default
})
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo para alterar" });

const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Id inválido");

export const transactionIdSchema = idSchema;

// Duplicar: o corpo é opcional; `data` é a data do novo lançamento (sem ela, vale o momento da chamada).
export const duplicateTransactionSchema = z.object({ data: z.coerce.date().optional() }).default({});

// Máximo de itens por chamada em lote: o mesmo limite de itens por página da listagem.
const LIMITE_LOTE = 100;
const semRepetidos = (ids: string[]) => new Set(ids).size === ids.length;

// Edição em lote: cada transação leva as suas próprias alterações.
export const bulkUpdateSchema = z.object({
  itens: z
    .array(z.object({ id: idSchema, alteracoes: updateTransactionSchema }))
    .min(1)
    .max(LIMITE_LOTE)
    .refine((itens) => semRepetidos(itens.map((i) => i.id)), { message: "Ids repetidos" }),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(idSchema).min(1).max(LIMITE_LOTE).refine(semRepetidos, { message: "Ids repetidos" }),
});

export type UpdateTransactionDto = z.infer<typeof updateTransactionSchema>;
export type BulkUpdateDto = z.infer<typeof bulkUpdateSchema>;
export type DuplicateTransactionDto = z.infer<typeof duplicateTransactionSchema>;
export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;

// Mensagens trocadas com o Servidor Java (Servidor/src/main/java/com/financeai/transactions/): os nomes dos campos
// são exatamente os do JSON de PedidoCategorizarTransacao e de RespostaCategorizarTransacao.
export interface PedidoCategorizarTransacao {
  descricao: string;
  valor: number;
}
export interface RespostaCategorizarTransacao {
  categoria: string;
}
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

// Resposta das operações em lote: quantas foram feitas e quais ids não existem (ou não são do usuário).
export interface BulkResultDto {
  afetadas: number;
  naoEncontradas: string[];
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
