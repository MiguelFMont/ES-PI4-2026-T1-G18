# investments.model.ts — Schemas de investimentos e parcelamentos

## O que deve ter neste arquivo
- Duas coleções deste módulo: `investments` (ativos simulados do usuário: nome, valor investido) e `installments` (parcelamentos ativos do cartão: descrição, parcela atual/total, valor mensal, se ainda está ativo).

## Exemplo de implementação

```ts
// src/modules/investments/investments.model.ts
import { Schema, model } from "mongoose";

interface InvestmentDocument {
  userId: string;
  nome: string;
  valor: number;
}

const InvestmentSchema = new Schema<InvestmentDocument>(
  {
    userId: { type: String, required: true, index: true },
    nome: { type: String, required: true },
    valor: { type: Number, required: true },
  },
  { timestamps: true }
);

export const InvestmentModel = model<InvestmentDocument>("Investment", InvestmentSchema);

interface InstallmentDocument {
  userId: string;
  descricao: string;
  parcelaAtual: number;
  totalParcelas: number;
  valorMensal: number;
  ativo: boolean;
}

const InstallmentSchema = new Schema<InstallmentDocument>(
  {
    userId: { type: String, required: true, index: true },
    descricao: { type: String, required: true },
    parcelaAtual: { type: Number, required: true },
    totalParcelas: { type: Number, required: true },
    valorMensal: { type: Number, required: true },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const InstallmentModel = model<InstallmentDocument>("Installment", InstallmentSchema);
```
