// src/middlewares/error-handler.middleware.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error";

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

  console.error("[error-handler] Erro não tratado:", err);
  return res
    .status(500)
    .json({ error: { message: "Erro interno do servidor", code: "INTERNAL_ERROR" } });
}
