# transactions.routes.ts — Rotas de transações

## O que deve ter neste arquivo
- CRUD de lançamentos (receitas e despesas), a ação de duplicar e a importação via sandbox Open Finance (Pluggy), sob `/v1/transactions`.
- Todas as rotas passam por `authMiddleware`: transações sempre pertencem a um usuário logado.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.routes.ts
import { Router } from "express";
import { transactionsController } from "./transactions.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const transactionsRouter = Router();

transactionsRouter.use(authMiddleware);

transactionsRouter.get("/", transactionsController.list);
transactionsRouter.post("/", transactionsController.create);
transactionsRouter.put("/:id", transactionsController.update);
transactionsRouter.delete("/:id", transactionsController.remove);
transactionsRouter.post("/:id/duplicate", transactionsController.duplicate);
transactionsRouter.post("/import", transactionsController.importFromPluggy);
```
