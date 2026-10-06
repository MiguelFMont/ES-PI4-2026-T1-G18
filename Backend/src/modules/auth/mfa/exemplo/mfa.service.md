# mfa.service.ts — Regra de negócio do MFA

## O que deve ter neste arquivo
- `enable`: marca `mfaEnabled = true` no usuário (via `authRepository`) e retorna os dados necessários para o app autenticador.
- `validate`: delega a validação do código ao Servidor Java (`PedidoValidarMFA`), usando o `java` da conexão recebido por parâmetro. É o Java que conhece o algoritmo de verificação; o Backend envia o segredo guardado do usuário, porque o Servidor Java não acessa o MongoDB.
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
    const segredo = await authRepository.findMfaSecret(userId);
    const { valido } = await java.enviarPedido<
      { userId: string; segredo: string; codigo: string },
      { valido: boolean }
    >("PedidoValidarMFA", "RespostaValidarMFA", { userId, segredo, codigo });

    if (!valido) {
      throw new AppError("Código MFA inválido", 401, "INVALID_MFA_CODE");
    }
    return { valido: true };
  },
};
```
