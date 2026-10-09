# app-error.ts — Erro de negócio compartilhado

## O que deve ter neste arquivo
- Uma classe `AppError` que qualquer `service` de qualquer módulo pode lançar quando uma regra de negócio é violada (e-mail duplicado, recurso não encontrado, credencial inválida etc).
- Carrega três informações (no caso de erros vindos do Servidor Java, o `statusCode` é deduzido do `code` em `error-codes.ts`): a mensagem, o `statusCode` HTTP que a resposta deve ter (`409` conflito, `404` não encontrado, `401` não autorizado, `503` servidor Java indisponível etc.) e um `code` estável, para o Frontend decidir o que fazer sem depender do texto da mensagem.
- É o que o `middlewares/error-handler.middleware.ts` reconhece: se o erro for um `AppError`, responde com o `statusCode` e o `code` dele; qualquer outro erro é logado e vira um `500` genérico, sem vazar detalhe interno.

## Exemplo de implementação

```ts
// src/shared/errors/app-error.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}
```
