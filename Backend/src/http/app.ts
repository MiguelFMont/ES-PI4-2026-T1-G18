// src/http/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { sistemaRouter } from "../modules/sistema/sistema.routes";
import { errorHandler } from "../middlewares/error-handler.middleware";
import { AppError } from "../shared/errors/app-error";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/v1", sistemaRouter);

// Cada grupo adiciona UMA linha aqui quando seu router existir, por exemplo:
// app.use("/v1/auth", authRouter);
// app.use("/v1/transactions", transactionsRouter);
// app.use("/v1/dashboard", dashboardRouter);
// app.use("/v1/mentor-ia", mentorIaRouter);
// app.use("/v1/goals", goalsRouter);
// app.use("/v1/investments", investmentsRouter);

app.use((_req, _res, next) => next(new AppError("Rota não encontrada", 404, "NOT_FOUND")));

// Sempre por último, depois de todas as rotas.
app.use(errorHandler);
