# app.ts — Instância do Express (montagem das rotas)

## O que deve ter neste arquivo
- Cria a instância do Express e registra os middlewares globais (`helmet`, `cors`, `express.json()`).
- Monta o router de cada módulo sob um prefixo comum: `/v1/auth`, `/v1/transactions`, `/v1/dashboard`, `/v1/mentor-ia`, `/v1/goals`, `/v1/investments`.
- Registra o `error-handler.middleware` **por último**, depois de todas as rotas.
- Não tem `app.listen(...)`: isso fica no `server.ts`, para os testes poderem importar o `app` sem abrir uma porta.
- Cada grupo só adiciona uma linha aqui (o `app.use` do seu router).

## Exemplo de implementação

```ts
// src/http/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "../modules/auth/auth.routes";
import { transactionsRouter } from "../modules/transactions/transactions.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";
import { mentorIaRouter } from "../modules/mentor-ia/mentor-ia.routes";
import { goalsRouter } from "../modules/goals/goals.routes";
import { investmentsRouter } from "../modules/investments/investments.routes";
import { errorHandler } from "../middlewares/error-handler.middleware";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/v1/auth", authRouter);
app.use("/v1/transactions", transactionsRouter);
app.use("/v1/dashboard", dashboardRouter);
app.use("/v1/mentor-ia", mentorIaRouter);
app.use("/v1/goals", goalsRouter);
app.use("/v1/investments", investmentsRouter);

app.use(errorHandler);
```
