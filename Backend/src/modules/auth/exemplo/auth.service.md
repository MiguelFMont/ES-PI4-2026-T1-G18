# auth.service.ts — Regras de negócio de autenticação

## O que deve ter neste arquivo
- Casos de uso: `register`, `login`, `getProfile`.
- No `register`: verifica se o e-mail já existe (via `authRepository`), pede o hash da senha ao Servidor Java (`PedidoHashSenha`) e só então salva o usuário.
- No `login`: busca o usuário, valida a senha (também pelo Servidor Java) e emite o JWT (`jsonwebtoken`) que o Frontend guarda e reenvia na mensagem `Autenticar` ao reconectar (ver `ws/ws-auth.ts`).
- Recebe o `java` (`JavaServerClient` da conexão) como **parâmetro**, vindo do handler — não importa singleton nenhum, já que cada usuário tem a sua conexão com o Servidor Java.
- Não conhece a conexão WebSocket (isso é do `auth.handler.ts`) nem monta query do Mongo (isso é do repository).

## Exemplo de implementação

```ts
// src/modules/auth/auth.service.ts
import jwt from "jsonwebtoken";
import { authRepository } from "./auth.repository";
import { JavaServerClient } from "../../java-client/java-server.client";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { RegisterDto, LoginDto } from "./auth.dto";

export const authService = {
  async register(dados: RegisterDto, java: JavaServerClient) {
    const existente = await authRepository.findByEmail(dados.email);
    if (existente) {
      throw new AppError("E-mail já cadastrado", 409, "EMAIL_IN_USE");
    }

    const { hash } = await java.enviarPedido<{ senha: string }, { hash: string }>(
      "PedidoHashSenha",
      "RespostaHashSenha",
      { senha: dados.senha }
    );

    const usuario = await authRepository.create({ ...dados, senhaHash: hash });
    return { id: usuario.id, nome: usuario.nome, email: usuario.email };
  },

  async login(dados: LoginDto, java: JavaServerClient) {
    const usuario = await authRepository.findByEmail(dados.email);
    if (!usuario) {
      throw new AppError("Credenciais inválidas", 401, "INVALID_CREDENTIALS");
    }

    const { valido } = await java.enviarPedido<
      { senha: string; hash: string },
      { valido: boolean }
    >("PedidoValidarSenha", "RespostaValidarSenha", {
      senha: dados.senha,
      hash: usuario.senhaHash,
    });

    if (!valido) {
      throw new AppError("Credenciais inválidas", 401, "INVALID_CREDENTIALS");
    }

    const token = jwt.sign({ id: usuario.id, email: usuario.email }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, token };
  },

  async getProfile(id: string) {
    const usuario = await authRepository.findById(id);
    if (!usuario) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }
    return { id: usuario.id, nome: usuario.nome, email: usuario.email, plano: usuario.plano };
  },
};
```
