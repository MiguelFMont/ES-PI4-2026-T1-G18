// src/modules/transactions/transactions.controller.ts
import { Response, NextFunction } from "express";
import { transactionsService } from "./transactions.service";
import {
  bulkDeleteSchema,
  bulkUpdateSchema,
  createTransactionSchema,
  transactionFiltersSchema,
} from "./transactions.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const transactionsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const filtros = transactionFiltersSchema.parse(req.query);
      res.status(200).json(await transactionsService.list(req.user!.id, filtros));
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const dados = createTransactionSchema.parse(req.body);
      res.status(201).json(await transactionsService.create(req.user!.id, dados));
    } catch (error) {
      next(error);
    }
  },

  async updateMany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { itens } = bulkUpdateSchema.parse(req.body);
      res.status(200).json(await transactionsService.updateMany(req.user!.id, itens));
    } catch (error) {
      next(error);
    }
  },

  async removeMany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = bulkDeleteSchema.parse(req.body);
      res.status(200).json(await transactionsService.removeMany(req.user!.id, ids));
    } catch (error) {
      next(error);
    }
  },
};
