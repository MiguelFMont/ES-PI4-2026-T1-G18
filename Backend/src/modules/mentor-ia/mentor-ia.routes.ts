// src/modules/mentor-ia/mentor-ia.routes.ts
import { Router } from "express";
import { mentorIaController } from "./mentor-ia.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const mentorIaRouter = Router();

mentorIaRouter.use(authMiddleware);

mentorIaRouter.post("/chat", mentorIaController.sendMessage);
mentorIaRouter.get("/chat", mentorIaController.history);
// O Mentor inicia a conversa explicando os alertas novos (o Frontend chama ao abrir o chat)
mentorIaRouter.post("/chat/proativa", mentorIaController.proactiveMessage);
// Os alertas são gerados (ou atualizados) a cada leitura: ver alertas.service.ts
mentorIaRouter.get("/alerts", mentorIaController.listAlerts);
mentorIaRouter.patch("/alerts/:id/lido", mentorIaController.markAlertRead);

export default mentorIaRouter;
