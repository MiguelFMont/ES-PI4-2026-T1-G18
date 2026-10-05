# auth.handler.ts — Mensagens WebSocket de autenticação

## O que deve ter neste arquivo
- Registra os tipos de mensagem de autenticação. Como a conexão WebSocket nasce **anônima**, três deles são **públicos** (`registrarPublico`): `"Registrar"`, `"Login"` e `"Autenticar"`. Só `"ObterPerfil"` exige usuário autenticado (`registrar`).
- `Login`: valida a senha, recebe o JWT do `authService` e chama `autenticar(...)`, marcando a conexão como autenticada. O token vai na resposta para o Frontend guardar.
- `Autenticar`: o Frontend manda o token que já tem (após recarregar a página ou reconectar) e a conexão é marcada como autenticada sem pedir a senha de novo. Token inválido ou expirado vira erro `401` (ver `ws/ws-auth.ts`).
- Os handlers públicos recebem `{ java, autenticar }`; o protegido recebe `{ usuario, java }`, com `usuario` garantido.
- Valida o payload com o DTO (`auth.dto.ts`) e delega ao `authService`. Sem regra de negócio aqui.
- Se o usuário tiver MFA ativo, o `Login` pode devolver `{ mfaRequired: true }` e **não** chamar `autenticar`; a conexão só é autenticada depois de `ValidarMfa` bem-sucedido (a definir pelo grupo de Autenticação).

## Exemplo de implementação

```ts
// src/modules/auth/auth.handler.ts
import { dispatcher } from "../../ws/dispatcher";
import { verificarToken } from "../../ws/ws-auth";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.dto";

dispatcher.registrarPublico("Registrar", async (dados, { java }) => {
  const payload = registerSchema.parse(dados);
  return authService.register(payload, java);
});

dispatcher.registrarPublico("Login", async (dados, { java, autenticar }) => {
  const payload = loginSchema.parse(dados);
  const { usuario, token } = await authService.login(payload, java);
  autenticar({ id: usuario.id, email: usuario.email });
  return { usuario, token };
});

dispatcher.registrarPublico("Autenticar", async (dados, { autenticar }) => {
  const { token } = dados as { token: string };
  autenticar(verificarToken(token));
  return { autenticado: true };
});

dispatcher.registrar("ObterPerfil", async (_dados, { usuario }) => {
  return authService.getProfile(usuario.id);
});
```
