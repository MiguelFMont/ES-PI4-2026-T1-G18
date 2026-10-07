# mentor-ia.controller.ts — Camada HTTP do mentor financeiro

## O que deve ter neste arquivo
- `sendMessage`: valida o texto da mensagem (`chatMessageSchema`) e chama o `mentorIaService`, que monta o contexto, consulta a IA e filtra a resposta. É a única rota "pesada"; as outras só leem o que já foi salvo.
- `history` e `alerts`: leitura simples, sempre do usuário logado.

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.controller.ts
import { Response, NextFunction } from "express";
import { mentorIaService } from "./mentor-ia.service";
import { chatMessageSchema } from "./mentor-ia.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const mentorIaController = {
  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { texto } = chatMessageSchema.parse(req.body);
      res.status(200).json(await mentorIaService.sendMessage(req.user!.id, texto));
    } catch (error) {
      next(error);
    }
  },

  async history(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await mentorIaService.getHistory(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async alerts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await mentorIaService.listAlerts(req.user!.id));
    } catch (error) {
      next(error);
    }
  },
};
```
