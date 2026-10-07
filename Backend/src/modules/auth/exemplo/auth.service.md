# auth.service.ts — Casos de uso de autenticação

## O que deve ter neste arquivo
- Casos de uso: `register`, `login`, `getProfile`. O Backend **não acessa o banco**: o usuário, a senha (hash) e as conferências ficam no Servidor Java, que é o dono dos dados. Este service só repassa o pedido ao Servidor pelo `javaServerClient` e devolve o resultado.
- `register`: envia `PedidoRegistrarUsuario` (o Servidor confere se o e-mail já existe, faz o hash da senha e grava o usuário). E-mail duplicado volta como `Erro` `409` e o `javaServerClient` já o transforma em `AppError`.
- `login`: envia `PedidoLogin` (o Servidor confere e-mail e senha). Se der certo, **o Backend assina o JWT** (`jsonwebtoken`, `JWT_SECRET`): o token é uma preocupação da camada HTTP, e o Servidor Java não o conhece. O Frontend envia o token no header `Authorization: Bearer` das próximas requisições.
- `getProfile`: envia `PedidoObterPerfil` com o `userId` que veio do token.
- Não conhece `req`/`res` do Express (isso é do `auth.controller.ts`).

## Exemplo de implementação

```ts
// src/modules/auth/auth.service.ts
import jwt from "jsonwebtoken";
import { javaServerClient } from "../../java-client/java-server.client";
import { env } from "../../config/env";
import { RegisterDto, LoginDto } from "./auth.dto";

interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
  plano: "free" | "pro";
  mfaEnabled: boolean;
}

export const authService = {
  register(dados: RegisterDto) {
    return javaServerClient.enviarPedido<RegisterDto, { id: string; nome: string; email: string }>(
      "PedidoRegistrarUsuario",
      "RespostaRegistrarUsuario",
      dados
    );
  },

  async login(dados: LoginDto) {
    const usuario = await javaServerClient.enviarPedido<LoginDto, UsuarioPublico>(
      "PedidoLogin",
      "RespostaLogin",
      dados
    );

    const token = jwt.sign({ id: usuario.id, email: usuario.email }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return { usuario, token };
  },

  getProfile(userId: string) {
    return javaServerClient.enviarPedido<{ userId: string }, UsuarioPublico>(
      "PedidoObterPerfil",
      "RespostaObterPerfil",
      { userId }
    );
  },
};
```
