import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";

export const authController = {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const dados = registerSchema.parse(req.body);
            const usuario = await authService.register(dados);

            res.status(201).json(usuario);
        } catch (error) {
            next(error);
        }
    },

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const dados = loginSchema.parse(req.body);
            const { usuario, token } = await authService.login(dados);

            res.status(200).json({ usuario, token });
        } catch (error) {
            next(error);
        }
    },

    async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const usuario = await authService.getProfile(req.user!.id);

            res.status(200).json(usuario);
        } catch (error) {
            next(error);
        }
    },
};
