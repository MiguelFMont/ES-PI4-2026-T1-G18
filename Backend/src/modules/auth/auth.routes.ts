import { Router } from "express";
import { authController } from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { mfaRouter } from "./mfa/mfa.routes";
import { limites } from "../../middlewares/rate-limit.middleware";

export const authRouter = Router();

// Limites de tentativas (429 TOO_MANY_REQUESTS): ver middlewares/rate-limit.middleware.ts
authRouter.post("/register", limites.cadastro, authController.register);
authRouter.post("/login", limites.loginPorIp, limites.login, authController.login);
authRouter.post("/login/mfa", limites.loginMfa, authController.loginMfa);
authRouter.post("/forgot-password", limites.recuperarSenhaPorIp, limites.recuperarSenhaPorEmail, authController.forgotPassword);
authRouter.post("/reset-password", authController.resetPassword);
authRouter.post("/verify-email", authController.verifyEmail);
authRouter.get("/me", authMiddleware, authController.me);
authRouter.patch("/me/plano", authMiddleware, authController.atualizarPlano);
authRouter.patch("/me", authMiddleware, authController.atualizarPerfil);
authRouter.use("/mfa", mfaRouter);
