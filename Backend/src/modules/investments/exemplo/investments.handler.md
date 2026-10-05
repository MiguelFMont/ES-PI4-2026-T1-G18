# investments.handler.ts — Mensagens WebSocket de investimentos

## O que deve ter neste arquivo
- Registra `"ObterPainelInvestimentos"` (patrimônio, portfólio) e `"ListarParcelamentos"` (parcelamentos ativos do cartão) no `dispatcher`.

## Exemplo de implementação

```ts
// src/modules/investments/investments.handler.ts
import { dispatcher } from "../../ws/dispatcher";
import { investmentsService } from "./investments.service";

dispatcher.registrar("ObterPainelInvestimentos", async (_dados, { usuario, java }) => {
  return investmentsService.getPortfolio(usuario.id, java);
});

dispatcher.registrar("ListarParcelamentos", async (_dados, { usuario }) => {
  return investmentsService.listInstallments(usuario.id);
});
```
