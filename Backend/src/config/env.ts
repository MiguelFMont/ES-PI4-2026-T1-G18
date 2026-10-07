// src/config/env.ts
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatório"),
  JAVA_SERVER_HOST: z.string().default("localhost"),
  JAVA_SERVER_PORT: z.coerce.number().default(3001),
  JAVA_SERVER_TIMEOUT_MS: z.coerce.number().default(5000),
  GENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
