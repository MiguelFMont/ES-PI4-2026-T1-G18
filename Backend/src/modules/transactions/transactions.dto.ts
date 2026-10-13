// src/modules/transactions/transactions.dto.ts
import { z } from "zod";

export const createTransactionSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  valor: z.number().positive(),
  categoria: z.string().trim().min(1).optional(),
  data: z.coerce.date(),
  descricao: z.string().trim().min(1),
  origem: z.enum(["manual", "pluggy"]).default("manual"),
});

export const transactionFiltersSchema = z
  .object({
    categoria: z.string().optional(),
    origem: z.enum(["manual", "pluggy"]).optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    valorMin: z.coerce.number().min(0).optional(),
    valorMax: z.coerce.number().min(0).optional(),
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
  origem: "manual" | "pluggy";
}
