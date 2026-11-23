/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/accounts/accounts.routes.ts
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { accountsController } from "./accounts.controller";

export const accountsRouter = Router();

// Contas sempre pertencem a um usuário logado.
accountsRouter.use(authMiddleware);

accountsRouter.get("/", accountsController.list);
accountsRouter.get("/banks", accountsController.banks); // antes de /:id
accountsRouter.post("/", accountsController.create);
accountsRouter.patch("/:id", accountsController.update);
accountsRouter.delete("/:id", accountsController.remove);

export default accountsRouter;
