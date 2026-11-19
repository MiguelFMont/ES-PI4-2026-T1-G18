// src/modules/investments/investments.routes.ts
import { Router } from "express";
import { investmentsController } from "./investments.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const investmentsRouter = Router();

// Investimentos e cartão sempre pertencem a um usuário logado.
investmentsRouter.use(authMiddleware);

// Portfólio simulado
investmentsRouter.get("/", investmentsController.list);
investmentsRouter.post("/", investmentsController.create);

// Cartão de crédito simulado (antes de "/:id", que senão tomaria "card" por um id)
investmentsRouter.get("/card", investmentsController.getCard);
investmentsRouter.patch("/card", investmentsController.updateCard);
investmentsRouter.get("/card/installments", investmentsController.listInstallments);
investmentsRouter.post("/card/installments", investmentsController.createInstallment);
investmentsRouter.patch("/card/installments/:id", investmentsController.updateInstallment);
investmentsRouter.delete("/card/installments/:id", investmentsController.removeInstallment);

investmentsRouter.delete("/:id", investmentsController.remove);

export default investmentsRouter;
