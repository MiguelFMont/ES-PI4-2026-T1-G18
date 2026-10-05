# transactions.handler.ts — Mensagens WebSocket de transações

## O que deve ter neste arquivo
- Um `dispatcher.registrar(...)` por operação: `"ListarTransacoes"`, `"CriarTransacao"`, `"AtualizarTransacao"`, `"RemoverTransacao"`, `"DuplicarTransacao"`, `"ImportarTransacoesPluggy"`.
- Todas usam `usuario.id` da conexão autenticada nunca um `userId` vindo de dentro do payload da mensagem.
- Segue exatamente a mesma divisão de responsabilidade que o `transactions.controller.ts` tinha: valida o payload com o DTO e delega ao `transactionsService`.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.handler.ts
import { dispatcher } from "../../ws/dispatcher";
import { transactionsService } from "./transactions.service";
import { createTransactionSchema, transactionFiltersSchema } from "./transactions.dto";

dispatcher.registrar("ListarTransacoes", async (dados, { usuario }) => {
  const filtros = transactionFiltersSchema.parse(dados);
  return transactionsService.list(usuario.id, filtros);
});

dispatcher.registrar("CriarTransacao", async (dados, { usuario, java }) => {
  const payload = createTransactionSchema.parse(dados);
  return transactionsService.create(usuario.id, payload, java);
});

dispatcher.registrar("AtualizarTransacao", async (dados, { usuario }) => {
  const { id, ...resto } = dados as { id: string } & Record<string, unknown>;
  return transactionsService.update(usuario.id, id, resto);
});

dispatcher.registrar("RemoverTransacao", async (dados, { usuario }) => {
  const { id } = dados as { id: string };
  await transactionsService.remove(usuario.id, id);
  return { removida: true };
});

dispatcher.registrar("DuplicarTransacao", async (dados, { usuario }) => {
  const { id } = dados as { id: string };
  return transactionsService.duplicate(usuario.id, id);
});

dispatcher.registrar("ImportarTransacoesPluggy", async (dados, { usuario }) => {
  return transactionsService.importFromPluggy(usuario.id, dados);
});
```
