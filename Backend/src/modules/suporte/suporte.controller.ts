/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { suporteService } from "./suporte.service";

export const suporteController = {
    async criar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const usuarioId = req.user!.id;

            const resultado = await suporteService.criar(
                usuarioId,
                req.body
            );

            return res.status(201).json(resultado);
        } catch (erro) {
            next(erro);
        }
    }
};
