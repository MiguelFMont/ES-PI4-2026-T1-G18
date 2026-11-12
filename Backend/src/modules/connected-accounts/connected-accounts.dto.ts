// src/modules/connected-accounts/connected-accounts.dto.ts
import { z } from "zod";

// Conectar uma conta que o usuário criou pelo widget Pluggy Connect: o Frontend manda o id do item.
export const connectSchema = z.object({
  itemId: z.string().uuid(),
});

export const accountIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Id inválido"),
});

// O que o Frontend recebe: sem o id do item da Pluggy nem campos internos do Mongo.
export interface ConnectedAccountResponseDto {
  id: string;
  instituicao: string;
  status: string;
  contas: { id: string; tipo: string; nome: string; saldo?: number; moeda?: string }[];
  ultimaSincronizacao?: string; // ISO 8601
  criadaEm: string; // ISO 8601
}

// Resultado de uma importação de transações.
export interface ResultadoImportacao {
  lidas: number; // quantas a Pluggy devolveu
  importadas: number; // quantas entraram agora
  ignoradas: {
    duplicadas: number; // já importadas antes
    pendentes: number; // ainda não confirmadas pelo banco (PENDING)
    zeradas: number;
    faturaCartao: number; // pagamento da fatura do cartão (transferência, não é gasto)
    invalidas: number;
  };
}
