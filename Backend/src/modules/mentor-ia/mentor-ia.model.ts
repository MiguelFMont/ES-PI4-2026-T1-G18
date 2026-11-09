// src/modules/mentor-ia/mentor-ia.model.ts
import { Schema, model } from "mongoose";
import { TIPOS_ALERTA, TipoAlerta } from "./alertas.regras";

export interface ChatMessageDocument {
  userId: string;
  autor: "usuario" | "ia";
  texto: string;
  proativa?: boolean; // mensagem que o Mentor mandou sozinho, explicando alertas (POST /chat/proativa)
  createdAt: Date;
}

const ChatMessageSchema = new Schema<ChatMessageDocument>(
  {
    userId: { type: String, required: true },
    autor: { type: String, enum: ["usuario", "ia"], required: true },
    texto: { type: String, required: true },
    proativa: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// histórico do usuário em ordem de envio
ChatMessageSchema.index({ userId: 1, createdAt: -1 });

export const ChatMessageModel = model<ChatMessageDocument>("ChatMessage", ChatMessageSchema);

// Alertas (coleção `alerts`): gerados pelo Backend quando o usuário lê os alertas (alertas.regras.ts).
export interface AlertDocument {
  userId: string;
  tipo: TipoAlerta;
  chave: string; // ex.: "fatura_proxima:2026-11"; única por usuário
  titulo: string;
  mensagem: string;
  dados: Record<string, string | number>;
  lido: boolean;
  explicadoEm?: Date; // quando o Mentor já explicou o alerta no chat
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<AlertDocument>(
  {
    userId: { type: String, required: true },
    tipo: { type: String, enum: TIPOS_ALERTA, required: true },
    chave: { type: String, required: true },
    titulo: { type: String, required: true },
    mensagem: { type: String, required: true },
    dados: { type: Schema.Types.Mixed, default: {} },
    lido: { type: Boolean, default: false },
    explicadoEm: { type: Date },
  },
  { timestamps: true, collection: "alerts" }
);

// um alerta por chave: reler os alertas atualiza o mesmo documento em vez de duplicar
AlertSchema.index({ userId: 1, chave: 1 }, { unique: true });
// listagem dos não lidos, mais recentes primeiro
AlertSchema.index({ userId: 1, lido: 1, createdAt: -1 });

export const AlertModel = model<AlertDocument>("Alert", AlertSchema);
