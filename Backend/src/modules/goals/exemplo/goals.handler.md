# goals.handler.ts — Mensagens WebSocket de metas financeiras

## O que deve ter neste arquivo
- CRUD de metas via `dispatcher`: `"ListarMetas"`, `"CriarMeta"`, `"AtualizarMeta"`, `"RemoverMeta"`, mais `"ObterProgressoMeta"` para o cálculo de progresso.

## Exemplo de implementação

```ts
// src/modules/goals/goals.handler.ts
import { dispatcher } from "../../ws/dispatcher";
import { goalsService } from "./goals.service";
import { createGoalSchema } from "./goals.dto";

dispatcher.registrar("ListarMetas", async (_dados, { usuario }) => {
  return goalsService.list(usuario.id);
});

dispatcher.registrar("CriarMeta", async (dados, { usuario }) => {
  const payload = createGoalSchema.parse(dados);
  return goalsService.create(usuario.id, payload);
});

dispatcher.registrar("AtualizarMeta", async (dados, { usuario }) => {
  const { id, ...resto } = dados as { id: string } & Record<string, unknown>;
  return goalsService.update(usuario.id, id, resto);
});

dispatcher.registrar("RemoverMeta", async (dados, { usuario }) => {
  const { id } = dados as { id: string };
  await goalsService.remove(usuario.id, id);
  return { removida: true };
});

dispatcher.registrar("ObterProgressoMeta", async (dados, { usuario, java }) => {
  const { id } = dados as { id: string };
  return goalsService.getProgress(usuario.id, id, java);
});
```
