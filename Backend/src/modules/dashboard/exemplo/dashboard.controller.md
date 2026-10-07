# dashboard.controller.ts — Camada HTTP do painel

## O que deve ter neste arquivo
- `summary`: saldo, gastos do mês, economia e fluxo de caixa do período atual.
- `byCategory`: distribuição de gastos por categoria (e por grupo de categorias).
- `comparePeriods`: comparação mensal, últimos 6 meses ou YTD, a partir de `req.query.periodo`.
- Só leitura: nenhuma dessas rotas grava dados.

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.controller.ts
import { Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const dashboardController = {
  async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await dashboardService.getSummary(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async byCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await dashboardService.getByCategory(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async comparePeriods(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const periodo = String(req.query.periodo ?? "mensal");
      res.status(200).json(await dashboardService.comparePeriods(req.user!.id, periodo));
    } catch (error) {
      next(error);
    }
  },
};
```
