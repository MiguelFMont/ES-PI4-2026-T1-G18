# goals.routes.ts — Rotas de metas financeiras

## O que deve ter neste arquivo
- CRUD de metas sob `/v1/goals`, mais `GET /:id/progress` para o cálculo de progresso.
- Todas protegidas por `authMiddleware`.

## Exemplo de implementação

```ts
// src/modules/goals/goals.routes.ts
import { Router } from "express";
import { goalsController } from "./goals.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const goalsRouter = Router();

goalsRouter.use(authMiddleware);

goalsRouter.get("/", goalsController.list);
goalsRouter.post("/", goalsController.create);
goalsRouter.put("/:id", goalsController.update);
goalsRouter.delete("/:id", goalsController.remove);
goalsRouter.get("/:id/progress", goalsController.progress);
```
