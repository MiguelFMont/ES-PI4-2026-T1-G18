/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/transactions/transactions.dto.ts
import { z } from "zod";
import { FORMAS_PAGAMENTO, FormaPagamento } from "./transactions.model";
import { AccountResumoDto } from "../accounts/accounts.dto";

const ID_INVALIDO = "Id inválido";
// Máximo de parcelas de uma compra no crédito.
export const MAX_PARCELAS = 24;

const createTransactionBase = z.object({
  tipo: z.enum(["receita", "despesa"]),
  valor: z.number().positive(),
  // a conta do lançamento (obrigatória, RN5): uma conta do próprio usuário
  contaId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO),
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
  // vincula a transação a uma meta do próprio usuário (o valor dela conta como aporte no progresso da meta)
  metaId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO).optional(),
  // cartão de crédito do próprio usuário e número de parcelas: só valem com formaPagamento "credito" (ver o refine abaixo)
  cartaoId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO).optional(),
  parcelas: z.number().int().min(1).max(MAX_PARCELAS).optional(),
});

export const createTransactionSchema = createTransactionBase.superRefine((d, ctx) => {
  if (d.formaPagamento !== "credito") {
    if (d.cartaoId) ctx.addIssue({ code: "custom", path: ["cartaoId"], message: "O cartão só vale com a forma de pagamento crédito" });
    if (d.parcelas !== undefined && d.parcelas !== 1) {
      ctx.addIssue({ code: "custom", path: ["parcelas"], message: "As parcelas só valem com a forma de pagamento crédito" });
    }
  }
  if (d.parcelas !== undefined && d.parcelas > 1) {
    if (d.tipo !== "despesa") ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Só despesas podem ser parceladas" });
    if (d.origem !== "manual") ctx.addIssue({ code: "custom", path: ["parcelas"], message: "Transações importadas não podem ser parceladas" });
  }
});

export const transactionFiltersSchema = z
  .object({
    tipo: z.enum(["receita", "despesa", "transferencia"]).optional(),
    categoria: z.string().optional(),
    // id de uma conta: as lançadas nela e as transferências que chegaram a ela
    contaId: z.string().regex(/^[a-f\d]{24}$/i, "Id inválido").optional(),
    formaPagamento: z.enum(FORMAS_PAGAMENTO).optional(),
    origem: z.enum(["manual", "pluggy"]).optional(),
    // id de uma meta (só as vinculadas a ela) ou "nenhuma" (só as sem meta)
    metaId: z.union([z.string().regex(/^[a-f\d]{24}$/i, "Id inválido"), z.literal("nenhuma")]).optional(),
    // id de um cartão do usuário: só as despesas no crédito dele (as sem cartão contam para o cartão padrão, como na fatura)
    cartaoId: z.string().regex(/^[a-f\d]{24}$/i, "Id inválido").optional(),
    busca: z.string().trim().min(1).max(100).optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    valorMin: z.coerce.number().min(0).optional(),
    valorMax: z.coerce.number().min(0).optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    // todos=true: devolve tudo o que passa nos filtros, sem paginar (o "Tudo" do "Por página" da tela); `limite` e `pagina` não valem
    todos: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
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
  // mover o lançamento para outra conta (manual) e, só em transferência, trocar a conta de destino
  contaId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO),
  contaDestinoId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO),
  formaPagamento: z.enum(FORMAS_PAGAMENTO), // sem default
  metaId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO).nullable(), // null = desvincular da meta
  // null = desvincular do cartão. cartaoId e parcelas > 1 só valem se a forma de pagamento final for crédito (o service confere)
  cartaoId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO).nullable(),
  parcelas: z.number().int().min(1).max(MAX_PARCELAS),
})
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo para alterar" });

const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Id inválido");

export const transactionIdSchema = idSchema;

// Sugerir a categoria antes de gravar (botão "Sugerir" do formulário): só a descrição é obrigatória; o valor é opcional
// (o Servidor Java o recebe no pedido, mas hoje decide só pela descrição).
export const suggestCategorySchema = z.object({
  descricao: z.string().trim().min(1).max(200),
  valor: z.number().min(0).optional(),
});

// Transferência entre duas contas manuais do usuário (RN6 e RN7): um único registro, que não é receita nem despesa.
export const createTransferSchema = z.object({
  contaId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO), // origem
  contaDestinoId: z.string().regex(/^[a-f\d]{24}$/i, ID_INVALIDO),
  valor: z.number().positive(),
  data: z.coerce.date(),
  // em branco vira "Transferência"
  descricao: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((texto) => texto || undefined),
  observacoes: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((texto) => texto || undefined),
});

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

export type SuggestCategoryDto = z.infer<typeof suggestCategorySchema>;
export type UpdateTransactionDto = z.infer<typeof updateTransactionSchema>;
export type BulkUpdateDto = z.infer<typeof bulkUpdateSchema>;
export type DuplicateTransactionDto = z.infer<typeof duplicateTransactionSchema>;
export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
export type CreateTransferDto = z.infer<typeof createTransferSchema>;

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
  tipo: "receita" | "despesa" | "transferencia";
  valor: number;
  categoria: string;
  data: string; // ISO 8601
  descricao: string;
  observacoes?: string; // só aparece quando foi informada
  formaPagamento: FormaPagamento;
  origem: "manual" | "pluggy";
  contaId?: string; // a conta do lançamento (a de origem, na transferência)
  conta?: AccountResumoDto; // a mesma conta, com nome e banco para a tela
  contaDestinoId?: string; // só em transferência
  contaDestino?: AccountResumoDto; // só em transferência
  metaId?: string; // só aparece quando a transação foi vinculada a uma meta
  cartaoId?: string; // só aparece quando a compra no crédito foi ligada a um cartão (sem ele, conta para o cartão mais antigo)
  cartao?: { id: string; nome: string }; // o mesmo cartão, com o nome para a tela
  parcelas?: number; // só aparece em compras no crédito (1 = à vista)
  parcelamentoId?: string; // só aparece quando parcelas > 1: o parcelamento criado no cartão (seção 6)
}

// Resposta das operações em lote: quantas foram feitas e quais ids não existem (ou não são do usuário).
export interface BulkResultDto {
  afetadas: number;
  naoEncontradas: string[];
  desfazerId?: string; // só na exclusão em lote: POST /v1/undo/:id traz os lançamentos de volta
}

// Entradas, saídas e saldo de TODAS (transferências não entram: não são receita nem despesa, RN6) as transações que passam nos filtros (não só da página).
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
