// src/modules/mentor-ia/mentor-ia.dto.ts
import { z } from "zod";

export const chatMessageSchema = z.object({
  texto: z.string().trim().min(1).max(2000),
});

export type ChatMessageDto = z.infer<typeof chatMessageSchema>;

// O que o Frontend recebe: `id` no lugar de `_id`, sem `userId`.
export interface ChatMessageResponseDto {
  id: string;
  autor: "usuario" | "ia";
  texto: string;
  criadaEm: string; // ISO 8601
}

// Resposta de POST /chat: a mensagem do usuário e a resposta da IA, já salvas no histórico.
export interface ChatReplyResponseDto {
  pergunta: ChatMessageResponseDto;
  resposta: ChatMessageResponseDto;
}
