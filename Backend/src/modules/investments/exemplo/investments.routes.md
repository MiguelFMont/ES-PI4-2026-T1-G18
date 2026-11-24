# investments.routes.ts — Rotas de investimentos simulados

## O que deve ter neste arquivo
- Rotas somente de leitura sob `/v1/investments`: painel (patrimônio e portfólio) e parcelamentos ativos do cartão.
- Todas protegidas por `authMiddleware`.

## Exemplo de implementação

```ts
// src/modules/investments/investments.routes.ts
import { Router } from "express";
import { investmentsController } from "./investments.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const investmentsRouter = Router();

investmentsRouter.use(authMiddleware);

investmentsRouter.get("/portfolio", investmentsController.portfolio);
investmentsRouter.get("/installments", investmentsController.installments);
```
