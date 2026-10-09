# goals.model.ts — Schema da coleção de metas

## O que deve ter neste arquivo
- Schema Mongoose da coleção `goals`: `userId`, título, valor objetivo, valor atual (acumulado) e prazo.

## Exemplo de implementação

```ts
// src/modules/goals/goals.model.ts
import { Schema, model } from "mongoose";

interface GoalDocument {
  userId: string;
  titulo: string;
  valorObjetivo: number;
  valorAtual: number;
  prazo: Date;
}

const GoalSchema = new Schema<GoalDocument>(
  {
    userId: { type: String, required: true, index: true },
    titulo: { type: String, required: true },
    valorObjetivo: { type: Number, required: true },
    valorAtual: { type: Number, default: 0 },
    prazo: { type: Date, required: true },
  },
  { timestamps: true }
);

export const GoalModel = model<GoalDocument>("Goal", GoalSchema);
```
