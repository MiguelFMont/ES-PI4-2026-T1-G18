// src/modules/mentor-ia/mentor-ia.model.ts
// Os alertas (coleção `alerts`) entram aqui quando o grupo definir quem os gera.
import { Schema, model } from "mongoose";

export interface ChatMessageDocument {
  userId: string;
  autor: "usuario" | "ia";
  texto: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<ChatMessageDocument>(
  {
    userId: { type: String, required: true },
    autor: { type: String, enum: ["usuario", "ia"], required: true },
    texto: { type: String, required: true },
  },
  { timestamps: true }
);

// histórico do usuário em ordem de envio
ChatMessageSchema.index({ userId: 1, createdAt: -1 });

export const ChatMessageModel = model<ChatMessageDocument>("ChatMessage", ChatMessageSchema);
