// src/modules/desfazer/desfazer.routes.ts
// POST /v1/undo/:id: desfaz a última exclusão em cascata (conta ou cartão) que devolveu esse id. Ver shared/lixeira/lixeira.ts.
import { NextFunction, Response, Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middlewares/auth.middleware";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import { desfazerExclusao } from "../../shared/lixeira/lixeira";

const router = Router();
router.use(authMiddleware);

router.post("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    await desfazerExclusao(req.user!.id, id);
    res.status(200).json({ desfeito: true });
  } catch (erro) {
    next(erro);
  }
});

export default router;
