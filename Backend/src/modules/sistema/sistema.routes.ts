// src/modules/sistema/sistema.routes.ts
import { Router } from "express";
import { sistemaService } from "./sistema.service";

export const sistemaRouter = Router();

// O Backend está de pé (não depende do Servidor Java).
sistemaRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// O Backend consegue falar com o Servidor Java. Devolve os mesmos dados enviados;
// {"falhar":"negocio"} e {"falhar":"interno"} exercitam o caminho de erro.
sistemaRouter.post("/eco", async (req, res, next) => {
  try {
    res.json(await sistemaService.eco(req.body ?? {}));
  } catch (erro) {
    next(erro);
  }
});
