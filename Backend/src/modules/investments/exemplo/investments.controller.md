# investments.controller.ts — Camada HTTP de investimentos

## O que deve ter neste arquivo
- `portfolio`: devolve o patrimônio total e a lista de ativos simulados, com a rentabilidade calculada pelo Servidor Java (via `investmentsService`).
- `installments`: devolve os parcelamentos ativos do cartão (parcela atual/total e valor mensal).
- Só leitura, sempre do usuário logado.

## Exemplo de implementação

```ts
// src/modules/investments/investments.controller.ts
import { Response, NextFunction } from "express";
import { investmentsService } from "./investments.service";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const investmentsController = {
  async portfolio(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await investmentsService.getPortfolio(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async installments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await investmentsService.listInstallments(req.user!.id));
    } catch (error) {
      next(error);
    }
  },
};
```
