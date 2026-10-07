# transactions.service.ts — Casos de uso de transações

## O que deve ter neste arquivo
- Um método por operação, cada um repassando um pedido ao Servidor Java (o dono dos dados e da regra de categorização): `list`, `create`, `update`, `remove`, `duplicate` e `importFromPluggy`.
- Sempre envia o `userId` que veio do token (`req.user.id`), nunca um valor do corpo da requisição: o Servidor usa esse `userId` para restringir cada consulta ao dono.
- A **categorização automática** acontece dentro do Servidor: se `create` chegar sem `categoria`, o `TransactionsHandler` categoriza e grava. O Backend não precisa chamar nada à parte.
- `importFromPluggy`: o Backend chama a API da Pluggy (cliente HTTP externo, fora do escopo deste exemplo) e repassa a lista de transações ao Servidor em `PedidoImportarTransacoes`, que categoriza e grava.
- Erros de negócio (por exemplo, transação não encontrada) voltam como `Erro` com status HTTP e viram `AppError` no `javaServerClient`.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.service.ts
import { javaServerClient } from "../../java-client/java-server.client";
import { CreateTransactionDto, TransactionFiltersDto } from "./transactions.dto";

export const transactionsService = {
  async list(userId: string, filtros: TransactionFiltersDto) {
    const { transacoes } = await javaServerClient.enviarPedido<unknown, { transacoes: unknown[] }>(
      "PedidoListarTransacoes",
      "RespostaListarTransacoes",
      { userId, ...filtros }
    );
    return transacoes;
  },

  async create(userId: string, dados: CreateTransactionDto) {
    const { transacao } = await javaServerClient.enviarPedido<unknown, { transacao: unknown }>(
      "PedidoCriarTransacao",
      "RespostaCriarTransacao",
      { userId, ...dados }
    );
    return transacao;
  },

  async update(userId: string, id: string, dados: Partial<CreateTransactionDto>) {
    const { transacao } = await javaServerClient.enviarPedido<unknown, { transacao: unknown }>(
      "PedidoAtualizarTransacao",
      "RespostaAtualizarTransacao",
      { userId, id, ...dados }
    );
    return transacao;
  },

  async remove(userId: string, id: string) {
    await javaServerClient.enviarPedido<unknown, { removida: boolean }>(
      "PedidoRemoverTransacao",
      "RespostaRemoverTransacao",
      { userId, id }
    );
  },

  async duplicate(userId: string, id: string) {
    const { transacao } = await javaServerClient.enviarPedido<unknown, { transacao: unknown }>(
      "PedidoDuplicarTransacao",
      "RespostaDuplicarTransacao",
      { userId, id }
    );
    return transacao;
  },

  async importFromPluggy(userId: string, payload: unknown) {
    // 1) chamar a API da Pluggy (cliente externo) e obter as transações do sandbox
    const transacoes: unknown[] = []; // resultado da Pluggy
    // 2) o Servidor categoriza e grava
    return javaServerClient.enviarPedido<unknown, { importadas: number }>(
      "PedidoImportarTransacoes",
      "RespostaImportarTransacoes",
      { userId, transacoes }
    );
  },
};
```
