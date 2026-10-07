# mfa.controller.ts — Camada HTTP do MFA

## O que deve ter neste arquivo
- `enable`: habilita o MFA do usuário logado e devolve o que o app autenticador precisa.
- `validate`: recebe o `codigo` em `req.body` e devolve se ele é válido (a verificação em si é feita pelo Servidor Java, via `mfaService`).
- Mesmas regras de qualquer controller: sem acesso direto a banco ou ao Servidor Java; erros sempre com `next(error)`.

## Exemplo de implementação

```ts
// src/modules/auth/mfa/mfa.controller.ts
import { Response, NextFunction } from "express";
import { mfaService } from "./mfa.service";
import { AuthenticatedRequest } from "../../../middlewares/auth.middleware";

export const mfaController = {
  async enable(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const resultado = await mfaService.enable(req.user!.id);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  },

  async validate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { codigo } = req.body as { codigo: string };
      const resultado = await mfaService.validate(req.user!.id, codigo);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  },
};
```
