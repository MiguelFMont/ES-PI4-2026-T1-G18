# env.ts — Configuração (carregamento de variáveis de ambiente)

## O que deve ter neste arquivo
- Leitura das variáveis de ambiente (`process.env`, via `dotenv`).
- Validação de que todas as variáveis obrigatórias existem e têm o tipo certo (ex.: porta é número) — falha rápido (`process.exit`) se faltar alguma, em vez de deixar o erro aparecer só quando a variável for usada.
- Um objeto único (`env`) exportado e tipado, para o resto do código nunca ler `process.env` diretamente.
- Não tem lógica de negócio nem acesso a banco — só configuração.

## Exemplo de implementação

```ts
// src/config/env.ts
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatório"),
  JAVA_SERVER_HOST: z.string().default("localhost"),
  JAVA_SERVER_PORT: z.coerce.number().default(3000),
  JAVA_SERVER_TIMEOUT_MS: z.coerce.number().default(5000),
  GENAI_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
```
