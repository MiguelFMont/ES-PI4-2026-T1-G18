// src/modules/mentor-ia/mentor-ia.controller.ts
import { Response, NextFunction } from "express";
import { mentorIaService } from "./mentor-ia.service";
import { alertasService } from "./alertas.service";
import { alertIdParamsSchema, chatMessageSchema } from "./mentor-ia.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const mentorIaController = {
  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { texto } = chatMessageSchema.parse(req.body);
      res.status(200).json(await mentorIaService.sendMessage(req.user!.id, texto));
    } catch (error) {
      next(error);
    }
  },

  async proactiveMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await mentorIaService.proactiveMessage(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async history(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await mentorIaService.getHistory(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async listAlerts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await alertasService.listar(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async markAlertRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = alertIdParamsSchema.parse(req.params);
      res.status(200).json(await alertasService.marcarComoLido(req.user!.id, id));
    } catch (error) {
      next(error);
    }
  },
};
