# auth.repository.ts — Acesso a dados do usuário

## O que deve ter neste arquivo
- Funções de acesso direto à coleção de usuários no MongoDB (`findByEmail`, `findById`, `create`, `setMfaEnabled`), usando o `UserModel` (`auth.model.ts`).
- Nenhuma regra de negócio aqui — só consulta/grava e retorna o documento (ou `null`). Quem decide o que fazer com o resultado é o `auth.service.ts` (ou, no caso do MFA, o `mfa/mfa.service.ts`, que reaproveita este repository).
- É a única camada do módulo que importa o `UserModel` diretamente — se o banco mudar (ex.: trocar Mongoose por outro driver), só este arquivo muda.

## Exemplo de implementação

```ts
// src/modules/auth/auth.repository.ts
import { UserModel } from "./auth.model";
import { RegisterDto } from "./auth.dto";

export const authRepository = {
  async findByEmail(email: string) {
    return UserModel.findOne({ email }).lean();
  },

  async findById(id: string) {
    return UserModel.findById(id).lean();
  },

  async create(dados: RegisterDto & { senhaHash: string }) {
    const usuario = await UserModel.create({
      nome: dados.nome,
      email: dados.email,
      cpf: dados.cpf,
      senhaHash: dados.senhaHash,
    });
    return usuario.toObject();
  },

  async setMfaEnabled(userId: string, mfaEnabled: boolean) {
    return UserModel.findByIdAndUpdate(userId, { mfaEnabled }, { new: true }).lean();
  },
};
```
