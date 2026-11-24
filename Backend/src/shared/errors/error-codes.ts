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
