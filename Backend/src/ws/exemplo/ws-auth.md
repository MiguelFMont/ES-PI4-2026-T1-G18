# ws-auth.ts — Verificação do token JWT

## O que deve ter neste arquivo
- A conexão WebSocket **nasce anônima** (sem token no handshake). A autenticação acontece depois, por mensagem: `Login` (usuário digitou a senha) ou `Autenticar` (usuário já tem um token guardado, por exemplo após recarregar a página ou reconectar).
- Este arquivo só contém a função que verifica o JWT, usada pelo handler `Autenticar` (`auth.handler.ts`). Não decide o que fazer com o resultado: quem marca a conexão como autenticada é o `connection.ts`, via `autenticar(usuario)`.
- Token inválido ou expirado vira `AppError` `401`, para o Frontend receber `{ tipo: "Erro", dados: { code: "UNAUTHENTICATED" } }` em vez de um erro genérico.
- O token **não vai na URL** (`ws://...?token=`), porque URLs aparecem em logs. Ele viaja dentro da mensagem `Autenticar`.
- O token só é verificado no momento do `Autenticar`: uma conexão que já está aberta continua válida depois do token expirar. Se isso virar problema, o `connection.ts` pode guardar o `exp` e checar a cada mensagem.

## Exemplo de implementação

```ts
// src/ws/ws-auth.ts
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../shared/errors/app-error";

export interface UsuarioAutenticado {
  id: string;
  email: string;
}

export function verificarToken(token: string): UsuarioAutenticado {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as UsuarioAutenticado;
    return { id: payload.id, email: payload.email };
  } catch {
    throw new AppError("Token inválido ou expirado", 401, "UNAUTHENTICATED");
  }
}
```
