// Autor: Miguel Fernandes Monteiro
// RA: 25014808


// importar as rotas de cada módulo
import { Router } from "express";
import sistemaRouter from "./sistema/sistema.routes";
import transactionsRouter from "./transactions/transactions.routes";
import dashboardRouter from "./dashboard/dashboard.routes";
import mentorIaRouter from "./mentor-ia/mentor-ia.routes";
import { authRouter } from "./auth/auth.routes";

const router = Router();

router.use("/transactions", transactionsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/mentor-ia", mentorIaRouter);
router.use(sistemaRouter);
router.use("/auth", authRouter);

export default router;