// src/modules/mentor-ia/mentor-ia.dto.ts
import { z } from "zod";
import { TipoAlerta } from "./alertas.regras";

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

// Parâmetro :id de PATCH /alerts/:id/lido
export const alertIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Id inválido"),
});

// O que o Frontend recebe de um alerta: `id` no lugar de `_id`, sem `userId`, `chave` nem `explicadoEm`.
export interface AlertResponseDto {
  id: string;
  tipo: TipoAlerta;
  titulo: string;
  mensagem: string; // pt-BR, já com os valores formatados ("R$ 1.234,56")
  dados: Record<string, string | number>; // os números do alerta, para o Frontend montar a própria tela
  lido: boolean;
  criadaEm: string; // ISO 8601
}
