# auth.dto.ts — Contratos de entrada/saída

## O que deve ter neste arquivo
- Schemas de validação (`zod`) para o corpo de cada requisição: `registerSchema`, `loginSchema`.
- Os tipos TypeScript são **inferidos** do schema (`z.infer<...>`), então o tipo e a validação nunca ficam dessincronizados.
- Esses tipos são o que o `controller` valida e o que o `service` recebe como parâmetro — nenhuma outra camada deveria aceitar um objeto solto `any`.

## Exemplo de implementação

```ts
// src/modules/auth/auth.dto.ts
import { z } from "zod";

export const registerSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  cpf: z.string().length(11),
  senha: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
```
