/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema} from "./auth.dto";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../shared/errors/app-error";

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
            const resultado = await authService.login(dados);

            res.status(200).json(resultado);
        } catch (error) {
            next(error);
        }
    },

    async loginMfa(req: Request, res: Response, next: NextFunction) {
        try {
            const { mfaToken, codigo } = req.body;

            if (
                typeof mfaToken !== "string" ||
                !mfaToken ||
                typeof codigo !== "string" ||
                !/^\d{6}$/.test(codigo)
            ) {
                throw new AppError(
                    "Token temporário ou código MFA inválido.",
                    400,
                    "INVALID_MFA_REQUEST"
                );
            }
                const resultado = await authService.loginMfa(mfaToken, codigo);

            res.status(200).json(resultado);
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
    // Adicionando o método resetPassword
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
    // Adicionando o método atualizarPlano
    async atualizarPlano(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const plano = req.body?.plano;
            if (plano !== "free" && plano !== "pro") {
            res.status(400).json({ message: "Plano inválido." });
            return;
        }
        const usuario = await authService.atualizarPlano(req.user!.id, plano);
            res.status(200).json(usuario);
            } catch (error) {
                next(error);
            }
        },
        async atualizarPerfil(
            req: AuthenticatedRequest,
            res: Response,
            next: NextFunction) {
        try {
            const usuario = await authService.atualizarPerfil(
                req.user!.id,
                req.body
            );

            res.status(200).json(usuario);
            } catch (error) {
                next(error);
            }
        },
        async verifyEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const { token } = req.body;

            if (typeof token !== "string" || !token) {
                res.status(400).json({ message: "Token obrigatório." });
                return;
            }

            const resultado = await authService.verifyEmail(token); 
            res.status(200).json(resultado);
        } catch (error) {
            next(error);
        }
    },
};

