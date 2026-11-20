// src/modules/goals/goals.dto.ts
import { z } from "zod";

const titulo = z.string().trim().min(1).max(100);
const valorObjetivo = z.number().positive();
const valorInicial = z.number().min(0);

export const createGoalSchema = z.object({
  titulo,
  valorObjetivo,
  valorInicial: valorInicial.default(0),
  prazo: z.coerce.date().optional(), // opcional: sem ele a meta não tem prazo
});

// Edição: parcial, só o que muda (sem valores padrão, para um campo ausente não voltar ao padrão).
export const updateGoalSchema = z
  .object({
    titulo: titulo.optional(),
    valorObjetivo: valorObjetivo.optional(),
    valorInicial: valorInicial.optional(),
    prazo: z.union([z.null(), z.coerce.date()]).optional(), // null tira o prazo da meta
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo para alterar" });

export const goalIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Id inválido");

export type CreateGoalDto = z.infer<typeof createGoalSchema>;
export type UpdateGoalDto = z.infer<typeof updateGoalSchema>;

// Mensagens trocadas com o Servidor Java (Servidor/src/main/java/com/financeai/goals/): os nomes dos campos são
// exatamente os do JSON de PedidoProgressoMeta e de RespostaProgressoMeta.
export interface PedidoProgressoMeta {
  valorAtual: number;
  valorObjetivo: number;
  prazo: string; // ISO 8601
}
export interface RespostaProgressoMeta {
  percentual: number;
  falta: number;
  concluida: boolean;
  noPrazo: boolean;
  diasRestantes: number;
  mesesRestantes: number;
  aporteMensalNecessario: number;
}

// O que o Frontend recebe: `id` no lugar de `_id`, sem `userId`, com o progresso calculado.
// Sem prazo: `prazo`, `diasRestantes`, `mesesRestantes` e `aporteMensalNecessario` não vêm e `noPrazo` é sempre true.
export interface GoalResponseDto extends Omit<RespostaProgressoMeta, "diasRestantes" | "mesesRestantes" | "aporteMensalNecessario"> {
  id: string;
  titulo: string;
  valorObjetivo: number;
  valorInicial: number;
  prazo?: string; // ISO 8601
  diasRestantes?: number;
  mesesRestantes?: number;
  aporteMensalNecessario?: number;
  // valorInicial + a soma das transações vinculadas à meta
  valorAtual: number;
  // a soma e a quantidade das transações vinculadas à meta (os aportes)
  valorAportado: number;
  quantidadeAportes: number;
  criadaEm: string; // ISO 8601
}
