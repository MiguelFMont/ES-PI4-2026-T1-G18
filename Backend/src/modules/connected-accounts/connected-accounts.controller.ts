// src/modules/connected-accounts/connected-accounts.controller.ts
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { accountIdSchema, connectSchema } from "./connected-accounts.dto";
import { connectedAccountsService } from "./connected-accounts.service";

export const connectedAccountsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await connectedAccountsService.listar(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async connectToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json(await connectedAccountsService.criarConnectToken(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async connect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { itemId } = connectSchema.parse(req.body);
      res.status(201).json(await connectedAccountsService.conectar(req.user!.id, itemId));
    } catch (error) {
      next(error);
    }
  },

  async connectSandbox(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await connectedAccountsService.conectarSandbox(req.user!.id));
    } catch (error) {
      next(error);
    }
  },

  async sync(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = accountIdSchema.parse(req.params);
      res.status(200).json(await connectedAccountsService.sincronizar(req.user!.id, id));
    } catch (error) {
      next(error);
    }
  },

  async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = accountIdSchema.parse(req.params);
      await connectedAccountsService.desconectar(req.user!.id, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
