// src/modules/transactions/transactions.routes.ts
import { Router } from "express";
import { transactionsController } from "./transactions.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const transactionsRouter = Router();

// Transações sempre pertencem a um usuário logado.
transactionsRouter.use(authMiddleware);

transactionsRouter.get("/", transactionsController.list);
transactionsRouter.post("/", transactionsController.create);

// Próximas sprints: PUT /:id (#35), DELETE /:id, POST /:id/duplicate (#49), POST /import (#46)
