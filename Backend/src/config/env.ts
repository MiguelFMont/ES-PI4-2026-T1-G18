// src/config/env.ts
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatório"),
  // Banco (MongoDB Atlas). Sem MONGO_URI o Backend sobe sem banco, só para testar o
  // caminho Backend -> Servidor Java (/v1/health e /v1/eco).
  MONGO_URI: z.string().optional(),
  MONGO_DB: z.string().default("financeai"),
  JAVA_SERVER_HOST: z.string().default("localhost"),
  JAVA_SERVER_PORT: z.coerce.number().default(3000),
  JAVA_SERVER_TIMEOUT_MS: z.coerce.number().default(5000),
  JAVA_SERVER_POOL_SIZE: z.coerce.number().int().min(1).default(5),
  GENAI_API_KEY: z.string().optional(),
  GENAI_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GENAI_MODEL: z.string().default("openai/gpt-oss-120b"),
  GENAI_TIMEOUT_MS: z.coerce.number().default(20000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
