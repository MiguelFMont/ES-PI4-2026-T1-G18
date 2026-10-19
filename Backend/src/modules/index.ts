// Autor: Miguel Fernandes Monteiro
// RA: 25014808


// importar as rotas de cada módulo
import { Router } from "express";
import sistemaRouter from "./sistema/sistema.routes";
import transactionsRouter from "./transactions/transactions.routes";

const router = Router();

router.use("/transactions", transactionsRouter);
router.use(sistemaRouter);

export default router;