# transactions.controller.ts — Camada HTTP de transações

## O que deve ter neste arquivo
- Um método por rota: `list` (filtros na query string: categoria, período, valor, origem), `create`, `update`, `remove`, `duplicate`, `importFromPluggy`.
- Sempre usa `req.user!.id` para restringir a operação ao usuário logado; nunca confia em um `userId` vindo do body ou da query.
- Valida entrada com o DTO e delega ao `transactionsService`.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.controller.ts
import { Response, NextFunction } from "express";
import { transactionsService } from "./transactions.service";
import { createTransactionSchema, transactionFiltersSchema } from "./transactions.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const transactionsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const filtros = transactionFiltersSchema.parse(req.query);
      res.status(200).json(await transactionsService.list(req.user!.id, filtros));
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const dados = createTransactionSchema.parse(req.body);
      res.status(201).json(await transactionsService.create(req.user!.id, dados));
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const transacao = await transactionsService.update(req.user!.id, req.params.id, req.body);
      res.status(200).json(transacao);
    } catch (error) {
      next(error);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await transactionsService.remove(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async duplicate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await transactionsService.duplicate(req.user!.id, req.params.id));
    } catch (error) {
      next(error);
    }
  },

  async importFromPluggy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await transactionsService.importFromPluggy(req.user!.id, req.body));
    } catch (error) {
      next(error);
    }
  },
};
```
