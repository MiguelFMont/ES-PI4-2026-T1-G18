/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/goals/goals.model.ts
import { Schema, model } from "mongoose";
import { CORES, ICONES } from "../../shared/aparencia/aparencia";

// Uma meta de poupança. O progresso NÃO é guardado: é calculado a cada leitura (valorInicial + a soma das transações que o
// usuário vinculou à meta), para refletir edições e exclusões feitas no extrato.
export interface GoalDocument {
  userId: string;
  titulo: string;
  valorObjetivo: number;
  // quanto o usuário já tinha guardado quando criou a meta (opcional, 0 por padrão)
  valorInicial: number;
  prazo?: Date; // opcional: meta sem prazo não tem aporte mensal nem "vencida"
  // Aparência opcional (shared/aparencia).
  icone?: string | null; // null: sem ícone
  cor?: string | null;
}

const GoalSchema = new Schema<GoalDocument>(
  {
    userId: { type: String, required: true },
    titulo: { type: String, required: true, trim: true, maxlength: 100 },
    valorObjetivo: { type: Number, required: true, min: 0 },
    valorInicial: { type: Number, default: 0, min: 0 },
    prazo: { type: Date },
    icone: { type: String, enum: ICONES },
    cor: { type: String, enum: CORES },
  },
  { timestamps: true }
);

// a listagem é por usuário, das metas com prazo mais próximo para as mais distantes
GoalSchema.index({ userId: 1, prazo: 1 });

export const GoalModel = model<GoalDocument>("Goal", GoalSchema);
