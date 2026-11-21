
import { Router } from "express";
import { mfaController } from "./mfa.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

export const mfaRouter = Router();

mfaRouter.use(authMiddleware);

mfaRouter.post("/enable", mfaController.enable);
mfaRouter.post("/validate", mfaController.validate);
mfaRouter.post("/disable", mfaController.disable);
