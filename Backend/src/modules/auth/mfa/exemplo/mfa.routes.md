# mfa.routes.ts — Rotas de autenticação multifator

## O que deve ter neste arquivo
- Rotas do sub-módulo de MFA, montadas sob `/v1/auth/mfa` (registradas em `auth.routes.ts` com `authRouter.use("/mfa", mfaRouter)`).
- Todas exigem usuário logado (`authMiddleware`): habilitar e validar MFA é uma configuração da conta de um usuário existente.

## Exemplo de implementação

```ts
// src/modules/auth/mfa/mfa.routes.ts
import { Router } from "express";
import { mfaController } from "./mfa.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

export const mfaRouter = Router();

mfaRouter.use(authMiddleware);

mfaRouter.post("/enable", mfaController.enable);
mfaRouter.post("/validate", mfaController.validate);
```
