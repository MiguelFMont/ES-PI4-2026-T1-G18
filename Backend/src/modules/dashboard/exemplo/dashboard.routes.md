# dashboard.routes.ts — Rotas do painel financeiro

## O que deve ter neste arquivo
- Rotas somente de leitura sob `/v1/dashboard`: resumo geral, distribuição por categoria e comparação entre períodos.
- Todas protegidas por `authMiddleware`: o painel é sempre calculado sobre os dados do usuário logado.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.routes.ts
import { Router } from "express";
import { dashboardController } from "./dashboard.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get("/summary", dashboardController.summary);
dashboardRouter.get("/by-category", dashboardController.byCategory);
dashboardRouter.get("/compare", dashboardController.comparePeriods);
```
