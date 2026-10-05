# dashboard.handler.ts — Mensagens WebSocket do painel

## O que deve ter neste arquivo
- Registra `"ObterResumoPainel"`, `"ObterGastosPorCategoria"` e `"CompararPeriodos"` no `dispatcher`.
- Só leitura (nenhuma dessas mensagens grava nada) — todas delegam direto ao `dashboardService`, usando `usuario.id` da conexão autenticada.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.handler.ts
import { dispatcher } from "../../ws/dispatcher";
import { dashboardService } from "./dashboard.service";

dispatcher.registrar("ObterResumoPainel", async (_dados, { usuario, java }) => {
  return dashboardService.getSummary(usuario.id, java);
});

dispatcher.registrar("ObterGastosPorCategoria", async (_dados, { usuario }) => {
  return dashboardService.getByCategory(usuario.id);
});

dispatcher.registrar("CompararPeriodos", async (dados, { usuario }) => {
  const { periodo } = dados as { periodo: string };
  return dashboardService.comparePeriods(usuario.id, periodo);
});
```
