# (sem model próprio) — por que este módulo não tem dashboard.model.ts

## O que explicar neste caso
- O painel financeiro não é dono de nenhuma entidade persistida ele só lê e agrega dados que já pertencem ao módulo `transactions` (coleção `transactions`).
- Por isso o `dashboard.repository.ts` importa o `TransactionModel` do módulo `transactions` em vez de declarar um schema próprio.
- Se no futuro o grupo precisar cachear indicadores pesados (ex.: um snapshot diário pré-calculado), aí sim cria-se um `dashboard.model.ts` com uma coleção `dashboard_snapshots`, no mesmo padrão dos outros módulos. Até lá, manter esse arquivo "vazio" (sem model) é a opção mais simples e correta.

## Exemplo de implementação (se um cache futuro for necessário)

```ts
// src/modules/dashboard/dashboard.model.ts
import { Schema, model } from "mongoose";

interface DashboardSnapshotDocument {
  userId: string;
  referencia: Date; // ex.: primeiro dia do mês do snapshot
  saldo: number;
  economia: number;
  fluxoDeCaixa: number;
}

const DashboardSnapshotSchema = new Schema<DashboardSnapshotDocument>(
  {
    userId: { type: String, required: true, index: true },
    referencia: { type: Date, required: true },
    saldo: { type: Number, required: true },
    economia: { type: Number, required: true },
    fluxoDeCaixa: { type: Number, required: true },
  },
  { timestamps: true }
);

export const DashboardSnapshotModel = model<DashboardSnapshotDocument>(
  "DashboardSnapshot",
  DashboardSnapshotSchema
);
```
