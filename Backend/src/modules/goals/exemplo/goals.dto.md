# goals.dto.ts — Contratos de entrada/saída de metas

## O que deve ter neste arquivo
- `createGoalSchema`: payload para criar uma meta (título, valor objetivo, prazo). `valorAtual` nunca vem do cliente ele começa em 0 e só muda através das transações associadas à meta (fora do escopo deste exemplo).

## Exemplo de implementação

```ts
// src/modules/goals/goals.dto.ts
import { z } from "zod";

export const createGoalSchema = z.object({
  titulo: z.string().min(1),
  valorObjetivo: z.number().positive(),
  prazo: z.coerce.date(),
});

export type CreateGoalDto = z.infer<typeof createGoalSchema>;
```
