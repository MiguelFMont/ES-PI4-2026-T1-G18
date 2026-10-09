# investments.repository.ts — Acesso a dados de investimentos e parcelamentos

## O que deve ter neste arquivo
- `findInvestmentsByUser`: lista os ativos simulados do usuário.
- `findInstallmentsByUser`: lista os parcelamentos ativos do cartão do usuário.
- As duas coleções (`investments` e `installments`) são lidas aqui, mas cada uma tem seu próprio schema em `investments.model.ts`.

## Exemplo de implementação

```ts
// src/modules/investments/investments.repository.ts
import { InvestmentModel, InstallmentModel } from "./investments.model";

export const investmentsRepository = {
  async findInvestmentsByUser(userId: string) {
    return InvestmentModel.find({ userId }).lean();
  },

  async findInstallmentsByUser(userId: string) {
    return InstallmentModel.find({ userId, ativo: true }).lean();
  },
};
```
