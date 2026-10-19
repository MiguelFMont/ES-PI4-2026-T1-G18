// src/modules/dashboard/dashboard.routes.ts
import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get("/summary", dashboardController.summary);
dashboardRouter.get("/by-category", dashboardController.byCategory);

// Próximas sprints: GET /compare (comparação entre períodos via Servidor Java)