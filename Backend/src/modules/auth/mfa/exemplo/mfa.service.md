# mfa.service.ts — Casos de uso do MFA

## O que deve ter neste arquivo
- `enable`: envia `PedidoHabilitarMFA`. O Servidor Java gera o segredo TOTP, grava no usuário e devolve o segredo para o app autenticador (o segredo só sai do banco nesse momento de configuração).
- `validate`: envia `PedidoValidarMFA` com o `userId` e o código digitado. O Servidor lê o segredo do banco e verifica o código; o segredo **nunca** passa pelo Backend. Código inválido vira `AppError` `401`.
- Sem acesso ao banco: o MFA é um atributo do usuário, que pertence ao Servidor.

## Exemplo de implementação

```ts
// src/modules/auth/mfa/mfa.service.ts
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";

export const mfaService = {
  enable(userId: string) {
    return javaServerClient.enviarPedido<{ userId: string }, { mfaEnabled: boolean; segredo: string }>(
      "PedidoHabilitarMFA",
      "RespostaHabilitarMFA",
      { userId }
    );
  },

  async validate(userId: string, codigo: string) {
    const { valido } = await javaServerClient.enviarPedido<
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
