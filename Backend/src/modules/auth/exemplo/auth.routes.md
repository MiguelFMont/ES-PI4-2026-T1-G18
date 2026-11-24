# auth.routes.ts — Rotas de autenticação

## O que deve ter neste arquivo
- Um `express.Router()` só com a definição das rotas HTTP do módulo: método + caminho + método do controller que atende.
- `POST /v1/auth/register` e `POST /v1/auth/login` são **públicas**; `GET /v1/auth/me` usa o `authMiddleware`.
- Monta o sub-router de MFA em `/v1/auth/mfa`.
- Nenhuma lógica aqui; a validação do corpo é do controller (via DTO).

## Exemplo de implementação

```ts
// src/modules/auth/auth.routes.ts
import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { mfaRouter } from "./mfa/mfa.routes";

export const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.get("/me", authMiddleware, authController.me);

authRouter.use("/mfa", mfaRouter);
```
