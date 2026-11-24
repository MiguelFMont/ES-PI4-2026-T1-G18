/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { Router } from "express";
import { suporteController } from "./suporte.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
const router = Router();
router.post(
    "/",
    authMiddleware,
    suporteController.criar
);

export default router;
