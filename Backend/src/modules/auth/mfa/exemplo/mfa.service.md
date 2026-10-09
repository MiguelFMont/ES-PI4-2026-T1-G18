# mfa.service.ts — Regra de negócio do MFA

## O que deve ter neste arquivo
- `enable`: pede ao Servidor Java um segredo TOTP novo (`PedidoGerarSegredoMFA`), guarda o segredo no usuário (via `authRepository.setMfaSecret`, que também marca `mfaEnabled = true`) e devolve a `uri` `otpauth://` para o Frontend montar o QR code do app autenticador.
- `validate`: lê o segredo guardado e pede ao Servidor Java para conferir o código digitado (`PedidoValidarMFA`). É o Java que conhece o algoritmo de verificação; o segredo **nunca** é devolvido ao Frontend depois do `enable`.
- Reaproveita o `authRepository` do módulo `auth` em vez de criar um repository próprio: o MFA não é uma entidade nova, é um atributo do usuário.
- O fluxo completo no login (token temporário até validar o código) será definido por outro integrante do grupo de Autenticação.

## Exemplo de implementação

```ts
// src/modules/auth/mfa/mfa.service.ts
import { authRepository } from "../auth.repository";
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";

export const mfaService = {
  async enable(userId: string) {
    const usuario = await authRepository.findById(userId);
    if (!usuario) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }

    const { segredo, uri } = await javaServerClient.enviarPedido<
      { email: string },
      { segredo: string; uri: string }
    >("PedidoGerarSegredoMFA", "RespostaGerarSegredoMFA", { email: usuario.email });

    await authRepository.setMfaSecret(userId, segredo);
    return { mfaEnabled: true, uri };
  },

  async validate(userId: string, codigo: string) {
    const segredo = await authRepository.findMfaSecret(userId);
    if (!segredo) {
      throw new AppError("MFA não habilitado", 400, "MFA_NOT_ENABLED");
    }

    const { valido } = await javaServerClient.enviarPedido<
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
