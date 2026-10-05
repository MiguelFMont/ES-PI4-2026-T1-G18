# mentor-ia.handler.ts — Mensagens WebSocket do mentor financeiro (IA)

## O que deve ter neste arquivo
- Registra `"EnviarMensagemChat"`, `"ListarHistoricoChat"` e `"ListarAlertas"` no `dispatcher`.
- `EnviarMensagemChat` é a única das três que de fato "faz algo pesado" (monta contexto, chama a IA generativa, filtra a resposta) as outras duas só leem o que já foi salvo.

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.handler.ts
import { dispatcher } from "../../ws/dispatcher";
import { mentorIaService } from "./mentor-ia.service";
import { chatMessageSchema } from "./mentor-ia.dto";

dispatcher.registrar("EnviarMensagemChat", async (dados, { usuario, java }) => {
  const { texto } = chatMessageSchema.parse(dados);
  return mentorIaService.sendMessage(usuario.id, texto, java);
});

dispatcher.registrar("ListarHistoricoChat", async (_dados, { usuario }) => {
  return mentorIaService.getHistory(usuario.id);
});

dispatcher.registrar("ListarAlertas", async (_dados, { usuario }) => {
  return mentorIaService.listAlerts(usuario.id);
});
```
