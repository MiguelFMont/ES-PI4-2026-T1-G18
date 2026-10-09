# transactions.service.ts — Regras de negócio de transações

## O que deve ter neste arquivo
- `create`/`update`/`remove`/`duplicate`/`list`: CRUD no MongoDB pelo `transactionsRepository`, sempre restrito ao `userId` (o que vem do token, `req.user.id`, nunca do corpo da requisição).
- `list`: aplica os filtros (categoria, período, origem) delegando a query ao repository.
- **Categorização automática:** ao criar uma transação sem categoria, pede ao Servidor Java a categoria sugerida (`PedidoCategorizarTransacao`); a regra de categorização é do Java e o usuário pode sobrescrever depois com `update`.
- `importFromPluggy`: o Backend chama a API da Pluggy (cliente HTTP externo, fora do escopo deste exemplo), categoriza cada item que vier sem categoria e grava via repository.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.service.ts
import { transactionsRepository } from "./transactions.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";
import { CreateTransactionDto, TransactionFiltersDto } from "./transactions.dto";

async function categorizar(descricao: string, valor: number) {
  const { categoria } = await javaServerClient.enviarPedido<
    { descricao: string; valor: number },
    { categoria: string }
  >("PedidoCategorizarTransacao", "RespostaCategorizarTransacao", { descricao, valor });
  return categoria;
}

export const transactionsService = {
  async list(userId: string, filtros: TransactionFiltersDto) {
    return transactionsRepository.findByUser(userId, filtros);
  },

  async create(userId: string, dados: CreateTransactionDto) {
    const categoria = dados.categoria ?? (await categorizar(dados.descricao, dados.valor));
    return transactionsRepository.create({ ...dados, categoria, userId });
  },

  async update(userId: string, id: string, dados: Partial<CreateTransactionDto>) {
    const transacao = await transactionsRepository.updateByUser(userId, id, dados);
    if (!transacao) {
      throw new AppError("Transação não encontrada", 404, "TRANSACTION_NOT_FOUND");
    }
    return transacao;
  },

  async remove(userId: string, id: string) {
    await transactionsRepository.deleteByUser(userId, id);
  },

  async duplicate(userId: string, id: string) {
    const original = await transactionsRepository.findByIdAndUser(userId, id);
    if (!original) {
      throw new AppError("Transação não encontrada", 404, "TRANSACTION_NOT_FOUND");
    }
    const { _id, ...dados } = original;
    return transactionsRepository.create({ ...dados, userId } as never);
  },

  async importFromPluggy(userId: string, payload: unknown) {
    // 1) chamar a API da Pluggy (cliente externo) e obter as transações do sandbox
    const itens: Array<CreateTransactionDto> = []; // resultado da Pluggy
    // 2) categorizar (se faltar) e gravar cada uma, marcando a origem
    for (const item of itens) {
      const categoria = item.categoria ?? (await categorizar(item.descricao, item.valor));
      await transactionsRepository.create({ ...item, categoria, userId, origem: "pluggy" });
    }
    return { importadas: itens.length };
  },
};
```
