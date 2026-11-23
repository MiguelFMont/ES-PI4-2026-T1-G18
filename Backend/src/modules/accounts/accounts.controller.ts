/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/accounts/accounts.controller.ts
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { accountsService } from "./accounts.service";
import { accountIdSchema, createAccountSchema, updateAccountSchema } from "./accounts.dto";

export const accountsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await accountsService.list(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  banks(_req: AuthenticatedRequest, res: Response) {
    res.status(200).json(accountsService.banks());
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const dados = createAccountSchema.parse(req.body);
      res.status(201).json(await accountsService.create(req.user!.id, dados));
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = accountIdSchema.parse(req.params.id);
      const dados = updateAccountSchema.parse(req.body);
      res.status(200).json(await accountsService.update(req.user!.id, id, dados));
    } catch (error) {
      next(error);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = accountIdSchema.parse(req.params.id);
      res.status(200).json(await accountsService.remove(req.user!.id, id)); // { desfazerId, cartoes, lancamentos }
    } catch (error) {
      next(error);
    }
  },
};
