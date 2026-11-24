# auth.service.ts — Regras de negócio de autenticação

## O que deve ter neste arquivo
- Casos de uso: `register`, `login`, `getProfile`.
- O Backend é o dono do usuário no MongoDB (`authRepository`); o **Servidor Java** só faz a parte criptográfica, por mensagem.
- No `register`: verifica se o e-mail já existe (via `authRepository`), pede o hash da senha ao Servidor Java (`PedidoHashSenha`) e só então salva o usuário. A senha em texto puro nunca é gravada.
- No `login`: busca o usuário, pede ao Servidor Java para conferir a senha (`PedidoValidarSenha`) e, se estiver correta, **assina o JWT** (`jsonwebtoken`, `JWT_SECRET`). O Frontend guarda o token e o envia no header `Authorization: Bearer` das próximas requisições. A resposta inclui `mfaEnabled` para o fluxo de MFA (a definir pelo grupo).
- Usa o `javaServerClient` (pool de conexões duradouras com o Servidor); falhas do Servidor viram `AppError` `503` sozinhas.
- Não conhece `req`/`res` do Express (isso é do `auth.controller.ts`) nem monta query do Mongo (isso é do repository).

## Exemplo de implementação

```ts
// src/modules/auth/auth.service.ts
import jwt from "jsonwebtoken";
import { authRepository } from "./auth.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { RegisterDto, LoginDto } from "./auth.dto";

export const authService = {
  async register(dados: RegisterDto) {
    const existente = await authRepository.findByEmail(dados.email);
    if (existente) {
      throw new AppError("E-mail já cadastrado", 409, "EMAIL_IN_USE");
    }

    const { hash } = await javaServerClient.enviarPedido<{ senha: string }, { hash: string }>(
      "PedidoHashSenha",
      "RespostaHashSenha",
      { senha: dados.senha }
    );

    const usuario = await authRepository.create({ ...dados, senhaHash: hash });
    return { id: usuario._id.toString(), nome: usuario.nome, email: usuario.email };
  },

  async login(dados: LoginDto) {
    const usuario = await authRepository.findByEmail(dados.email);
    if (!usuario) {
      throw new AppError("Credenciais inválidas", 401, "INVALID_CREDENTIALS");
    }

    const { valido } = await javaServerClient.enviarPedido<
      { senha: string; hash: string },
      { valido: boolean }
    >("PedidoValidarSenha", "RespostaValidarSenha", {
      senha: dados.senha,
      hash: usuario.senhaHash,
    });

    if (!valido) {
      throw new AppError("Credenciais inválidas", 401, "INVALID_CREDENTIALS");
    }

    const id = usuario._id.toString();
    const token = jwt.sign({ id, email: usuario.email }, env.JWT_SECRET, { expiresIn: "7d" });

    return {
      usuario: { id, nome: usuario.nome, email: usuario.email, mfaEnabled: usuario.mfaEnabled },
      token,
    };
  },

  async getProfile(id: string) {
    const usuario = await authRepository.findById(id);
    if (!usuario) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }
    return {
      id: usuario._id.toString(),
      nome: usuario.nome,
      email: usuario.email,
      plano: usuario.plano,
      mfaEnabled: usuario.mfaEnabled,
    };
  },
};
```
