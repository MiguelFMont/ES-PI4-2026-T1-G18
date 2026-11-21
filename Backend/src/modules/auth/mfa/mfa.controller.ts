
import type { Request, Response, NextFunction } from "express";
import { mfaService } from "./mfa.service";
import type { AuthenticatedRequest } from "../../../middlewares/auth.middleware";

export const mfaController = {
    async enable(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) {
        try {
            const resultado = await mfaService.enable(req.user!.id);
            return res.status(200).json(resultado);
        } catch (erro) {
            next(erro);
        }
    },

    async validate(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) {
        try {
            const { codigo } = req.body;

            const resultado = await mfaService.validate(
                req.user!.id,
                codigo
            );

            return res.status(200).json(resultado);
        } catch (erro) {
            next(erro);
        }
    },

    async disable(
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) {
        try {
            const { codigo } = req.body;

            const resultado = await mfaService.disable(
                req.user!.id,
                codigo
            );

            return res.status(200).json(resultado);
        } catch (erro) {
            next(erro);
        }
    }
};
