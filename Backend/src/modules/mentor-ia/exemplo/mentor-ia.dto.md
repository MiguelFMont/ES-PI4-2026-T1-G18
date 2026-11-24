# mentor-ia.dto.ts — Contratos de entrada/saída do mentor financeiro

## O que deve ter neste arquivo
- `chatMessageSchema`: valida o payload da mensagem `"EnviarMensagemChat"` (só o texto digitado pelo usuário).

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.dto.ts
import { z } from "zod";

export const chatMessageSchema = z.object({
  texto: z.string().min(1).max(2000),
});

export type ChatMessageDto = z.infer<typeof chatMessageSchema>;
```
