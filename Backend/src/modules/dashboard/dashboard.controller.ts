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

    async byCategory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
        res.status(200).json(await dashboardService.getByCategory(req.user!.id));
        } catch (error) {
        next(error);
        }
    },
};