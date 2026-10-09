# auth.model.ts — Schema da coleção de usuários

## O que deve ter neste arquivo
- O schema Mongoose (`UserSchema`) e o model exportado (`UserModel`) que representam o documento salvo na coleção `users`.
- Campos de domínio do usuário: nome, e-mail (único), CPF, hash da senha, MFA (habilitado e segredo TOTP, que não vem nas consultas comuns: `select: false`), plano da conta, preferências.
- **Nunca** guarda a senha em texto puro — só o `senhaHash` calculado pelo Servidor Java (`PedidoHashSenha`).

## Exemplo de implementação

```ts
// src/modules/auth/auth.model.ts
import { Schema, model } from "mongoose";

interface UserDocument {
  nome: string;
  email: string;
  cpf: string;
  senhaHash: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  plano: "free" | "pro";
  preferencias: {
    tema: "claro" | "escuro";
    ocultarValores: boolean;
  };
}

const UserSchema = new Schema<UserDocument>(
  {
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    cpf: { type: String, required: true, unique: true },
    senhaHash: { type: String, required: true },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false }, // nunca sai nas consultas comuns
    plano: { type: String, enum: ["free", "pro"], default: "free" },
    preferencias: {
      tema: { type: String, enum: ["claro", "escuro"], default: "claro" },
      ocultarValores: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export const UserModel = model<UserDocument>("User", UserSchema);
```
