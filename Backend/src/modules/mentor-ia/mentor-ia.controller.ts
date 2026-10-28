// src/modules/mentor-ia/mentor-ia.controller.ts
import { Response, NextFunction } from "express";
import { mentorIaService } from "./mentor-ia.service";
import { chatMessageSchema } from "./mentor-ia.dto";
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

  async history(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await mentorIaService.getHistory(req.user!.id));
    } catch (error) {
      next(error);
    }
  },
};
