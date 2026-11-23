// src/modules/dashboard/dashboard.controller.ts
import { Response, NextFunction } from "express";
import { dashboardService } from "./dashboard.service";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const dashboardController = {
    async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            res.status(200).json(await dashboardService.getSummary(req.user!.id));
        } catch (error) {
            next(error);
        }
    },

    async periodSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const dataInicio = typeof req.query.dataInicio === "string" ? req.query.dataInicio : undefined;
            const dataFim = typeof req.query.dataFim === "string" ? req.query.dataFim : undefined;

            res.status(200).json(
                await dashboardService.getPeriodSummary(req.user!.id, dataInicio, dataFim)
            );
        } catch (error) {
            next(error);
        }
    },

    async byCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            res.status(200).json(await dashboardService.getByCategory(req.user!.id));
        } catch (error) {
            next(error);
        }
    },

    async compare(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const periodo = (req.query.periodo ?? req.query.tipo ?? "mes") as string;
            res.status(200).json(
                await dashboardService.comparePeriods(req.user!.id, periodo)
            );
        } catch (error) {
            next(error);
        }
    },
};