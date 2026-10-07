# mentor-ia.routes.ts — Rotas do mentor financeiro (IA)

## O que deve ter neste arquivo
- Rotas sob `/v1/mentor-ia`: enviar mensagem no chat, listar o histórico e listar os alertas.
- Todas protegidas por `authMiddleware`.
- Como a API é HTTP, o Frontend não recebe alertas "de graça": ele consulta `GET /alerts` (por exemplo, a cada abertura da tela ou em intervalos).

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.routes.ts
import { Router } from "express";
import { mentorIaController } from "./mentor-ia.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const mentorIaRouter = Router();

mentorIaRouter.use(authMiddleware);

mentorIaRouter.post("/chat", mentorIaController.sendMessage);
mentorIaRouter.get("/chat", mentorIaController.history);
mentorIaRouter.get("/alerts", mentorIaController.alerts);
```
