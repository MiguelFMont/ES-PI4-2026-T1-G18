# env.ts — Configuração (carregamento de variáveis de ambiente)

## O que deve ter neste arquivo
- Leitura das variáveis de ambiente (`process.env`, via `dotenv`).
- Validação de que todas as variáveis obrigatórias existem e têm o tipo certo (ex.: porta é número) — falha rápido (`process.exit`) se faltar alguma, em vez de deixar o erro aparecer só quando a variável for usada.
- Um objeto único (`env`) exportado e tipado, para o resto do código nunca ler `process.env` diretamente.
- `MONGO_URI` e `MONGO_DB` configuram o MongoDB (Atlas); `MONGO_URI` é opcional só para permitir subir o Backend sem banco e testar o caminho até o Servidor Java (`/v1/health`, `/v1/eco`). `JAVA_SERVER_POOL_SIZE` define o máximo de conexões simultâneas com o Servidor Java.
- Não tem lógica de negócio nem acesso a banco — só configuração.

## Exemplo de implementação

```ts
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
```
