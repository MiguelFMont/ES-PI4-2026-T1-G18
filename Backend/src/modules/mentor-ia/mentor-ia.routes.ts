// src/modules/mentor-ia/mentor-ia.routes.ts
import { Router } from "express";
import { mentorIaController } from "./mentor-ia.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const mentorIaRouter = Router();

mentorIaRouter.use(authMiddleware);

mentorIaRouter.post("/chat", mentorIaController.sendMessage);
mentorIaRouter.get("/chat", mentorIaController.history);

export default mentorIaRouter;

// Próximas sprints: GET /alerts (quando o grupo definir quem gera os alertas)
