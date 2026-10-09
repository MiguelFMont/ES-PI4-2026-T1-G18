# error-codes.ts — Tabela `code` → status HTTP

## O que deve ter neste arquivo
- O Servidor Java **não conhece HTTP**: a resposta `Erro` traz só `code` e `message`. Esta tabela é o único lugar em que o Backend decide qual status HTTP cada `code` do Servidor recebe.
- Usada pelo `java-client` ao transformar uma resposta `Erro` em `AppError`. `code` que não está na tabela vira `502 JAVA_SERVER_ERROR` (o Servidor mandou algo que o Backend não conhece).
- Os `code` do próprio Backend (`UNAUTHENTICATED`, `VALIDATION_ERROR`, `INVALID_MFA_CODE`, `JAVA_SERVER_*`) **não** entram aqui: o Backend os lança direto com o status certo.
- Fonte da verdade: esta tabela. Código novo lançado no Servidor (`ErroDeNegocio("CODE", ...)`) = linha nova aqui, combinada com o grupo; sem a linha, o Backend responde `502 JAVA_SERVER_ERROR`.
- O Servidor hoje só devolve `VALIDATION`, `UNKNOWN_TYPE` e `INTERNAL_ERROR` (mais o `TESTE_NEGOCIO` do `EcoHandler`). Erros de regra do Backend (e-mail duplicado, credenciais inválidas, recurso não encontrado) são `AppError` lançados direto pelos `service`, com o status certo.
- Convenção: `400` dado inválido, `401` credenciais inválidas, `404` não encontrado, `409` conflito (duplicado), `500` falha inesperada.

## Exemplo de implementação

```ts
// src/shared/errors/error-codes.ts
// Codes de erro que o SERVIDOR JAVA pode devolver (resposta "Erro") e o status HTTP de cada um.
const STATUS_POR_CODE = {
  VALIDATION: 400,
  UNKNOWN_TYPE: 400,
  TESTE_NEGOCIO: 409,
  INTERNAL_ERROR: 500,
} as const;

export function statusDoCodigo(code: string): number | undefined {
  return (STATUS_POR_CODE as Record<string, number>)[code];
}
```
