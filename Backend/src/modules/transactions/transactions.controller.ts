// src/modules/transactions/transactions.controller.ts
import { Response, NextFunction } from "express";
import { transactionsService } from "./transactions.service";
import { createTransactionSchema, transactionFiltersSchema } from "./transactions.dto";
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
};
