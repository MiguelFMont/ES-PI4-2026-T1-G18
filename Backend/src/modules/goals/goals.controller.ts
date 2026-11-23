/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/goals/goals.controller.ts
import { Response, NextFunction } from "express";
import { goalsService } from "./goals.service";
import { createGoalSchema, goalIdSchema, updateGoalSchema } from "./goals.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const goalsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await goalsService.list(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = goalIdSchema.parse(req.params.id);
      res.status(200).json(await goalsService.getById(req.user!.id, id));
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const dados = createGoalSchema.parse(req.body);
      res.status(201).json(await goalsService.create(req.user!.id, dados));
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = goalIdSchema.parse(req.params.id);
      const alteracoes = updateGoalSchema.parse(req.body);
      res.status(200).json(await goalsService.update(req.user!.id, id, alteracoes));
    } catch (error) {
      next(error);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = goalIdSchema.parse(req.params.id);
      await goalsService.remove(req.user!.id, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
