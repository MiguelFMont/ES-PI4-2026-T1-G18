# mentor-ia.model.ts — Schemas de chat e alertas

## O que deve ter neste arquivo
- Duas coleções relacionadas a este módulo: `chat_messages` (histórico da conversa com a IA) e `alerts` (avisos proativos gerados para o usuário). Ficam no mesmo arquivo porque são pequenas e sempre lidas/escritas juntas pelo mesmo repository — se crescerem, podem ser separadas em dois arquivos (`chat-message.model.ts`, `alert.model.ts`).

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.model.ts
import { Schema, model } from "mongoose";

interface ChatMessageDocument {
  userId: string;
  autor: "usuario" | "ia";
  texto: string;
}

const ChatMessageSchema = new Schema<ChatMessageDocument>(
  {
    userId: { type: String, required: true, index: true },
    autor: { type: String, enum: ["usuario", "ia"], required: true },
    texto: { type: String, required: true },
  },
  { timestamps: true }
);

export const ChatMessageModel = model<ChatMessageDocument>("ChatMessage", ChatMessageSchema);

interface AlertDocument {
  userId: string;
  tipo: "gasto_fora_do_padrao" | "fatura_proxima" | "dinheiro_parado";
  mensagem: string;
  lida: boolean;
}

const AlertSchema = new Schema<AlertDocument>(
  {
    userId: { type: String, required: true, index: true },
    tipo: {
      type: String,
      enum: ["gasto_fora_do_padrao", "fatura_proxima", "dinheiro_parado"],
      required: true,
    },
    mensagem: { type: String, required: true },
    lida: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AlertModel = model<AlertDocument>("Alert", AlertSchema);
```
