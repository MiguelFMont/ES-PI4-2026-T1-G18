// src/modules/transactions/transactions.routes.ts
import { Router } from "express";
import { transactionsController } from "./transactions.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const transactionsRouter = Router();

// Transações sempre pertencem a um usuário logado.
transactionsRouter.use(authMiddleware);

transactionsRouter.get("/", transactionsController.list);
transactionsRouter.post("/", transactionsController.create);
// Edição e exclusão só existem em lote (um item só também vale): não há PUT nem DELETE por id.
transactionsRouter.post("/:id/duplicate", transactionsController.duplicate);
transactionsRouter.patch("/bulk", transactionsController.updateMany);
transactionsRouter.post("/bulk-delete", transactionsController.removeMany);

export default transactionsRouter;

// Duplicar um lançamento: POST /:id/duplicate (#49). A importação da Pluggy fica em /v1/connected-accounts.
