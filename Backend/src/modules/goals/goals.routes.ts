/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/goals/goals.routes.ts
import { Router } from "express";
import { goalsController } from "./goals.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const goalsRouter = Router();

// Metas sempre pertencem a um usuário logado.
goalsRouter.use(authMiddleware);

goalsRouter.get("/", goalsController.list);
goalsRouter.post("/", goalsController.create);
goalsRouter.get("/:id", goalsController.getById);
goalsRouter.patch("/:id", goalsController.update);
goalsRouter.delete("/:id", goalsController.remove);

export default goalsRouter;
