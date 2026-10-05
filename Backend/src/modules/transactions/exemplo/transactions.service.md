# transactions.service.ts — Regras de negócio de transações

## O que deve ter neste arquivo
- `create`/`update`/`remove`/`duplicate`: regras simples de CRUD, sempre restritas ao `userId`.
- `list`: aplica os filtros (categoria, período, valor, origem) delegando a query real ao `transactionsRepository`.
- Categorização automática: ao criar uma transação sem categoria, pede ao Servidor Java (`PedidoCategorizarTransacao`) a categoria sugerida; o usuário pode depois sobrescrever manualmente.
- `importFromPluggy`: chama o client da Pluggy (fora do escopo deste arquivo de exemplo) e grava cada transação importada via `transactionsRepository.create`.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.service.ts
import { transactionsRepository } from "./transactions.repository";
import { JavaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";
import { CreateTransactionDto, TransactionFiltersDto } from "./transactions.dto";

export const transactionsService = {
  async list(userId: string, filtros: TransactionFiltersDto) {
    return transactionsRepository.findByUser(userId, filtros);
  },

  async create(userId: string, dados: CreateTransactionDto, java: JavaServerClient) {
    let categoria = dados.categoria;

    if (!categoria) {
      const resposta = await java.enviarPedido<
        { descricao: string; valor: number },
        { categoria: string }
      >("PedidoCategorizarTransacao", "RespostaCategorizarTransacao", {
        descricao: dados.descricao,
        valor: dados.valor,
      });
      categoria = resposta.categoria;
    }

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
    const { id: _id, ...dados } = original;
    return transactionsRepository.create({ ...dados, userId });
  },

  async importFromPluggy(userId: string, payload: unknown) {
    // chamaria o client da integração Pluggy e gravaria cada item retornado
    // via transactionsRepository.create({ ...item, userId, origem: "pluggy" })
    return { importadas: 0 };
  },
};
```
