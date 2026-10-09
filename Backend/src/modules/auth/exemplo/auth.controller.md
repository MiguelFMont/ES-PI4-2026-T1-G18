# auth.controller.ts — Camada HTTP da autenticação

## O que deve ter neste arquivo
- Um método por rota (`register`, `login`, `me`): lê `req.body`/`req.user`, valida o formato com o DTO (`auth.dto.ts`), chama o `authService` e monta a resposta com o status certo (`201` no cadastro, `200` no login).
- Não acessa o banco nem o Servidor Java: isso é do service (que usa o repository e o `javaServerClient`).
- Erros são repassados com `next(error)` para o `error-handler.middleware.ts`.
- Se o usuário tiver MFA ativo, o `login` pode devolver `{ mfaRequired: true, ... }` em vez do token final; a definição desse fluxo é do grupo de Autenticação.

## Exemplo de implementação

```ts
// src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const dados = registerSchema.parse(req.body);
      const usuario = await authService.register(dados);
      res.status(201).json(usuario);
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const dados = loginSchema.parse(req.body);
      const { usuario, token } = await authService.login(dados);
      res.status(200).json({ usuario, token });
    } catch (error) {
      next(error);
    }
  },

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const usuario = await authService.getProfile(req.user!.id);
      res.status(200).json(usuario);
    } catch (error) {
      next(error);
    }
  },
};
```
