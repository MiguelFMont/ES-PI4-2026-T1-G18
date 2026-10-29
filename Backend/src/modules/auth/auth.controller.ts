import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema} from "./auth.dto";
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
    async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
        const dados = forgotPasswordSchema.parse(req.body);
        await authService.forgotPassword(dados);

        res.status(200).json({
            message: "você receberá uma solicitação por email."
        });
    } catch (error) {
        next(error);
    }
},

async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
        const dados = resetPasswordSchema.parse(req.body);
        await authService.resetPassword(dados);

        res.status(200).json({
            message: "Senha redefinida com sucesso."
        });
    } catch (error) {
        next(error);
    }
},
};

