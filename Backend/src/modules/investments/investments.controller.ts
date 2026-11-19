// src/modules/investments/investments.controller.ts
import { Response, NextFunction } from "express";
import { investmentsService } from "./investments.service";
import {
  createInstallmentSchema,
  createInvestmentSchema,
  idSchema,
  updateCardSchema,
  updateInstallmentSchema,
} from "./investments.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

type Manipulador = (req: AuthenticatedRequest, res: Response) => Promise<void>;

// Todo manipulador passa o erro adiante (zod, AppError, Servidor Java) para o error-handler responder.
const tratar =
  (manipulador: Manipulador) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await manipulador(req, res);
    } catch (error) {
      next(error);
    }
  };

export const investmentsController = {
  // ------------------------------------------------------------------------------------------ portfólio
  list: tratar(async (req, res) => {
    res.status(200).json(await investmentsService.listInvestments(req.user!.id));
  }),

  create: tratar(async (req, res) => {
    const dados = createInvestmentSchema.parse(req.body);
    res.status(201).json(await investmentsService.createInvestment(req.user!.id, dados));
  }),

  remove: tratar(async (req, res) => {
    await investmentsService.removeInvestment(req.user!.id, idSchema.parse(req.params.id));
    res.status(204).send();
  }),

  // ------------------------------------------------------------------------------------------ cartão
  getCard: tratar(async (req, res) => {
    res.status(200).json(await investmentsService.getCard(req.user!.id));
  }),

  updateCard: tratar(async (req, res) => {
    const alteracoes = updateCardSchema.parse(req.body);
    res.status(200).json(await investmentsService.updateCard(req.user!.id, alteracoes));
  }),

  // ------------------------------------------------------------------------------------------ parcelamentos
  listInstallments: tratar(async (req, res) => {
    res.status(200).json(await investmentsService.listInstallments(req.user!.id));
  }),

  createInstallment: tratar(async (req, res) => {
    const dados = createInstallmentSchema.parse(req.body);
    res.status(201).json(await investmentsService.createInstallment(req.user!.id, dados));
  }),

  updateInstallment: tratar(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const alteracoes = updateInstallmentSchema.parse(req.body);
    res.status(200).json(await investmentsService.updateInstallment(req.user!.id, id, alteracoes));
  }),

  removeInstallment: tratar(async (req, res) => {
    await investmentsService.removeInstallment(req.user!.id, idSchema.parse(req.params.id));
    res.status(204).send();
  }),
};
