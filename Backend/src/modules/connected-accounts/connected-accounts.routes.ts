// src/modules/connected-accounts/connected-accounts.routes.ts
import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { connectedAccountsController } from "./connected-accounts.controller";

export const connectedAccountsRouter = Router();

// Contas conectadas sempre pertencem a um usuário logado.
connectedAccountsRouter.use(authMiddleware);

connectedAccountsRouter.get("/", connectedAccountsController.list);
connectedAccountsRouter.post("/", connectedAccountsController.connect);
connectedAccountsRouter.post("/connect-token", connectedAccountsController.connectToken);
connectedAccountsRouter.post("/sandbox", connectedAccountsController.connectSandbox);
connectedAccountsRouter.post("/:id/sync", connectedAccountsController.sync);
connectedAccountsRouter.delete("/:id", connectedAccountsController.disconnect);

export default connectedAccountsRouter;
