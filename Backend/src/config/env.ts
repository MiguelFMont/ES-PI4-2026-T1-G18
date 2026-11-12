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
  // Pluggy (Open Finance, sandbox): Client ID e Client Secret da aplicação criada no Dashboard da Pluggy. Só o Backend
  // pode ter estas credenciais (nunca no Frontend, nunca no Git). Sem elas, o Backend sobe e só a importação da Pluggy fica indisponível.
  PLUGGY_CLIENT_ID: z.string().optional(),
  PLUGGY_CLIENT_SECRET: z.string().optional(),
  GENAI_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GENAI_MODEL: z.string().default("openai/gpt-oss-120b"),
  GENAI_TIMEOUT_MS: z.coerce.number().default(20000),
  EMAIL_USER:z.email(),
  EMAIL_PASSWORD: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
