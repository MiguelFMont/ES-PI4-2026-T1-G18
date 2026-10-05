# mfa.service.ts — Regra de negócio do MFA

## O que deve ter neste arquivo
- `enable`: marca `mfaEnabled = true` no usuário (via `authRepository`) e retorna os dados necessários para o app autenticador.
- `validate`: delega a validação do código ao Servidor Java (`PedidoValidarMFA`), usando o `java` da conexão recebido por parâmetro. É o Java que conhece o algoritmo de verificação.
- Reaproveita o `authRepository` do módulo `auth` em vez de criar um repository próprio: o MFA não é uma entidade nova, é um atributo do usuário.

## Exemplo de implementação

```ts
// src/modules/auth/mfa/mfa.service.ts
import { authRepository } from "../auth.repository";
import { JavaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";

export const mfaService = {
  async enable(userId: string) {
    const usuario = await authRepository.setMfaEnabled(userId, true);
    if (!usuario) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }
    return { mfaEnabled: true };
  },

  async validate(userId: string, codigo: string, java: JavaServerClient) {
    const { valido } = await java.enviarPedido<
      { userId: string; codigo: string },
      { valido: boolean }
    >("PedidoValidarMFA", "RespostaValidarMFA", { userId, codigo });

    if (!valido) {
      throw new AppError("Código MFA inválido", 401, "INVALID_MFA_CODE");
    }
    return { valido: true };
  },
};
```
