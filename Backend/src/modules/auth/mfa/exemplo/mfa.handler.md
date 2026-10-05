# mfa.handler.ts — Mensagens WebSocket de MFA

## O que deve ter neste arquivo
- Registra `"HabilitarMfa"` e `"ValidarMfa"` no `dispatcher`. Diferente de `Registrar`/`Login`, essas duas mensagens **exigem** conexão já autenticada, então usam `usuario.id` normalmente.
- `ValidarMfa` repassa o `java` da conexão ao service, porque a verificação do código é feita pelo Servidor Java.
- Valida o payload e delega ao `mfaService`, sem lógica própria aqui.

## Exemplo de implementação

```ts
// src/modules/auth/mfa/mfa.handler.ts
import { dispatcher } from "../../../ws/dispatcher";
import { mfaService } from "./mfa.service";

dispatcher.registrar("HabilitarMfa", async (_dados, { usuario }) => {
  return mfaService.enable(usuario.id);
});

dispatcher.registrar("ValidarMfa", async (dados, { usuario, java }) => {
  const { codigo } = dados as { codigo: string };
  return mfaService.validate(usuario.id, codigo, java);
});
```
