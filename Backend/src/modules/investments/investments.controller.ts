// src/modules/investments/investments.controller.ts
import { Response, NextFunction } from "express";
import { investmentsService } from "./investments.service";
import {
  createCardSchema,
  createInstallmentSchema,
  createInvestmentSchema,
  idSchema,
  listInstallmentsQuerySchema,
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

  // ------------------------------------------------------------------------------------------ cartões
  listCards: tratar(async (req, res) => {
    res.status(200).json(await investmentsService.listCards(req.user!.id));
  }),

  getCardById: tratar(async (req, res) => {
    res.status(200).json(await investmentsService.getCardById(req.user!.id, idSchema.parse(req.params.id)));
  }),

  createCard: tratar(async (req, res) => {
    const dados = createCardSchema.parse(req.body);
    res.status(201).json(await investmentsService.createCard(req.user!.id, dados));
  }),

  updateCardById: tratar(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const alteracoes = updateCardSchema.parse(req.body);
    res.status(200).json(await investmentsService.updateCardById(req.user!.id, id, alteracoes));
  }),

  removeCardById: tratar(async (req, res) => {
    await investmentsService.removeCardById(req.user!.id, idSchema.parse(req.params.id));
    res.status(204).send();
  }),

  // Rotas antigas: o cartão padrão (o mais antigo)
  getCard: tratar(async (req, res) => {
    res.status(200).json(await investmentsService.getCard(req.user!.id));
  }),

  updateCard: tratar(async (req, res) => {
    const alteracoes = updateCardSchema.parse(req.body);
    res.status(200).json(await investmentsService.updateCard(req.user!.id, alteracoes));
  }),

  // ------------------------------------------------------------------------------------------ parcelamentos
  listInstallments: tratar(async (req, res) => {
    const { cartaoId } = listInstallmentsQuerySchema.parse(req.query);
    res.status(200).json(await investmentsService.listInstallments(req.user!.id, cartaoId));
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
