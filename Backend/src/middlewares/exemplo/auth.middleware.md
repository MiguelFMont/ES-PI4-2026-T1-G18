# auth.middleware.ts — Verificação do token JWT

## O que deve ter neste arquivo
- Middleware que lê o header `Authorization: Bearer <token>`, valida o JWT com `env.JWT_SECRET` e, se válido, coloca o usuário em `req.user` (`{ id, email }`).
- Token ausente, inválido ou expirado: chama `next(new AppError(..., 401, "UNAUTHENTICATED"))`, e o `error-handler` devolve o `401`. A requisição nunca chega ao controller.
- É usado pelas rotas de **todas as features** que exigem usuário logado (transactions, dashboard, mentor-ia, goals, investments e `GET /auth/me`), por isso fica em `middlewares/` e não dentro do módulo `auth`. `register` e `login` não o usam.
- Só autentica a requisição; não decide regra de negócio.
- Exporta também o tipo `AuthenticatedRequest`, usado pelos controllers.

## Exemplo de implementação

```ts
// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../shared/errors/app-error";

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return next(new AppError("Token não fornecido", 401, "UNAUTHENTICATED"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch {
    next(new AppError("Token inválido ou expirado", 401, "UNAUTHENTICATED"));
  }
}
```
