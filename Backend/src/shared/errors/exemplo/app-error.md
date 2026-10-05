# app-error.ts — Erro de negócio compartilhado

## O que deve ter neste arquivo
- Uma classe `AppError` que qualquer `service` de qualquer módulo pode lançar quando uma regra de negócio é violada (e-mail duplicado, recurso não encontrado, credencial inválida etc).
- Carrega três informações: a mensagem para log/usuário, um `codigo` estável (para o Frontend decidir o que fazer, sem depender do texto da mensagem) e, por convenção, um "status" conceitual (não é HTTP aqui, já que não há Express — é só uma categoria: `409` = conflito, `404` = não encontrado, `401` = não autorizado etc., reaproveitado como convenção de código).
- É a única coisa que a camada `ws/connection.ts` sabe distinguir de um erro inesperado: se for `AppError`, manda a mensagem/código de volta pro Frontend; se não for, loga e manda um erro genérico (sem vazar detalhe interno).

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
