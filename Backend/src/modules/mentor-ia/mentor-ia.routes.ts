// src/modules/mentor-ia/mentor-ia.routes.ts
import { Router } from "express";
import { mentorIaController } from "./mentor-ia.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { limites } from "../../middlewares/rate-limit.middleware";

export const mentorIaRouter = Router();

mentorIaRouter.use(authMiddleware);

// Cada mensagem chama a API de IA: até 10 por minuto por usuário (429 TOO_MANY_REQUESTS)
mentorIaRouter.post("/chat", limites.chatMentor, mentorIaController.sendMessage);
mentorIaRouter.get("/chat", mentorIaController.history);
// O Mentor inicia a conversa explicando os alertas novos (o Frontend chama ao abrir o chat)
mentorIaRouter.post("/chat/proativa", mentorIaController.proactiveMessage);
// Os alertas são gerados (ou atualizados) a cada leitura: ver alertas.service.ts
mentorIaRouter.get("/alerts", mentorIaController.listAlerts);
mentorIaRouter.patch("/alerts/:id/lido", mentorIaController.markAlertRead);

export default mentorIaRouter;
