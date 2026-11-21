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

// Cartões de crédito simulados (até 5 por usuário). Antes de "/:id", que senão tomaria "cards" por um id.
investmentsRouter.get("/cards", investmentsController.listCards);
investmentsRouter.post("/cards", investmentsController.createCard);
investmentsRouter.get("/cards/:id", investmentsController.getCardById);
investmentsRouter.patch("/cards/:id", investmentsController.updateCardById);
investmentsRouter.delete("/cards/:id", investmentsController.removeCardById);

// Rotas de antes dos vários cartões: /card é o cartão padrão (o mais antigo). Os parcelamentos valem para todos os cartões.
investmentsRouter.get("/card", investmentsController.getCard);
investmentsRouter.patch("/card", investmentsController.updateCard);
investmentsRouter.get("/card/installments", investmentsController.listInstallments);
investmentsRouter.post("/card/installments", investmentsController.createInstallment);
investmentsRouter.patch("/card/installments/:id", investmentsController.updateInstallment);
investmentsRouter.delete("/card/installments/:id", investmentsController.removeInstallment);

investmentsRouter.delete("/:id", investmentsController.remove);

export default investmentsRouter;
