# goals.controller.ts — Camada HTTP de metas financeiras

## O que deve ter neste arquivo
- Um método por rota: `list`, `create` (valida com `createGoalSchema`), `update`, `remove` e `progress` (o cálculo do percentual é feito pelo Servidor Java, via `goalsService`).
- Sempre usa `req.user!.id` para restringir a operação ao dono da meta.

## Exemplo de implementação

```ts
// src/modules/goals/goals.controller.ts
import { Response, NextFunction } from "express";
import { goalsService } from "./goals.service";
import { createGoalSchema } from "./goals.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const goalsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await goalsService.list(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const dados = createGoalSchema.parse(req.body);
      res.status(201).json(await goalsService.create(req.user!.id, dados));
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await goalsService.update(req.user!.id, req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await goalsService.remove(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async progress(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await goalsService.getProgress(req.user!.id, req.params.id));
    } catch (error) {
      next(error);
    }
  },
};
```
