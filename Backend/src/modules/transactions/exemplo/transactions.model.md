# transactions.model.ts — Schema da coleção de transações

## O que deve ter neste arquivo
- Schema Mongoose da coleção `transactions`: `userId` (quem é o dono), tipo (receita/despesa), valor, categoria, data, descrição, origem (manual/pluggy).
- Índice composto em `(userId, data)` ajuda bastante nas consultas de listagem/dashboard mais pra frente.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.model.ts
import { Schema, model } from "mongoose";

interface TransactionDocument {
  userId: string;
  tipo: "receita" | "despesa";
  valor: number;
  categoria: string;
  data: Date;
  descricao: string;
  origem: "manual" | "pluggy";
}

const TransactionSchema = new Schema<TransactionDocument>(
  {
    userId: { type: String, required: true, index: true },
    tipo: { type: String, enum: ["receita", "despesa"], required: true },
    valor: { type: Number, required: true },
    categoria: { type: String, required: true },
    data: { type: Date, required: true },
    descricao: { type: String, required: true },
    origem: { type: String, enum: ["manual", "pluggy"], default: "manual" },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, data: -1 });

export const TransactionModel = model<TransactionDocument>("Transaction", TransactionSchema);
```
