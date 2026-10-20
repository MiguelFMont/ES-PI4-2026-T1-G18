// src/http/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import  router   from "../modules/index";
import { frontendRouter } from "./frontend";
import { errorHandler } from "../middlewares/error-handler.middleware";
import { AppError } from "../shared/errors/app-error";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/v1", router);

// O Frontend é entregue pelo próprio Backend (páginas em /, /transactions...). Depois da API e antes do 404.
app.use(frontendRouter);

app.use((_req, _res, next) => next(new AppError("Rota não encontrada", 404, "NOT_FOUND")));

// Sempre por último, depois de todas as rotas.
app.use(errorHandler);
