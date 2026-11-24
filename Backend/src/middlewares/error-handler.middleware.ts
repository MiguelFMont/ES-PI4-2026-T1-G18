// src/middlewares/error-handler.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error";

// Erro 11000 do driver do MongoDB (E11000 duplicate key error).
function ehChaveDuplicada(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ error: { message: err.message, code: err.code } });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: "Dados inválidos", code: "VALIDATION_ERROR", details: err.flatten().fieldErrors },
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res
      .status(400)
      .json({ error: { message: "JSON inválido", code: "VALIDATION_ERROR" } });
  }

  // Chave duplicada no MongoDB (índice único): dois pedidos simultâneos gravando o mesmo dado passam pelas checagens
  // do service ao mesmo tempo e só o banco percebe. É conflito (409), não erro interno.
  if (ehChaveDuplicada(err)) {
    return res
      .status(409)
      .json({ error: { message: "Já existe um registro com esses dados", code: "DUPLICATE_KEY" } });
  }

  console.error("[error-handler] Erro não tratado:", err);
  return res
    .status(500)
    .json({ error: { message: "Erro interno do servidor", code: "INTERNAL_ERROR" } });
}
