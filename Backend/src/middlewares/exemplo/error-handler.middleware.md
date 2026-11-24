# error-handler.middleware.ts — Tratamento centralizado de erros

## O que deve ter neste arquivo
- Middleware de erro do Express (assinatura de 4 parâmetros: `err, req, res, next`) que recebe qualquer erro repassado com `next(err)` pelos controllers e middlewares.
- `AppError` vira a resposta HTTP com o `statusCode` do erro: `{ error: { message, code } }`. Também cobre os erros do `java-client` (`503` servidor fora do ar, `502` erro do servidor).
- Erro de validação do `zod` (`ZodError`) vira `400` com a lista dos campos inválidos.
- Qualquer outro erro é logado no servidor e vira `500` genérico, sem expor detalhes internos.
- Formato único de erro: o Frontend decide o que fazer pelo `code`, nunca pelo texto da mensagem.

## Exemplo de implementação

```ts
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

  console.error("[error-handler] Erro não tratado:", err);
  return res
    .status(500)
    .json({ error: { message: "Erro interno do servidor", code: "INTERNAL_ERROR" } });
}
```
