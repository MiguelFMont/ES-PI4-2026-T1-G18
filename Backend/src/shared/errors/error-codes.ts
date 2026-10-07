// src/shared/errors/error-codes.ts
const STATUS_POR_CODE = {
  VALIDATION: 400,
  INVALID_ID: 400,
  UNKNOWN_TYPE: 400,
  MFA_NOT_ENABLED: 400,
  INVALID_CREDENTIALS: 401,
  USER_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  GOAL_NOT_FOUND: 404,
  EMAIL_IN_USE: 409,
  TESTE_NEGOCIO: 409,
  INTERNAL_ERROR: 500,
} as const;

export function statusDoCodigo(code: string): number | undefined {
  return (STATUS_POR_CODE as Record<string, number>)[code];
}
