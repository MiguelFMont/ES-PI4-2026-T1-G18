// src/modules/dashboard/__tests__/ambiente.ts
import "../../transactions/__tests__/ambiente";

process.env.MFA_JWT_SECRET ??= "segredo-mfa-de-teste-com-mais-de-32-caracteres";