# transactions.dto.ts — Contratos de entrada/saída de transações

## O que deve ter neste arquivo
- `createTransactionSchema`: payload para criar receita/despesa (tipo, valor, categoria opcional, data, descrição, origem).
- `transactionFiltersSchema`: payload da query string usada na listagem (categoria, período, valor, origem), todos opcionais.

## Exemplo de implementação

```ts
// src/modules/transactions/transactions.dto.ts
import { z } from "zod";

export const createTransactionSchema = z.object({
  tipo: z.enum(["receita", "despesa"]),
  valor: z.number().positive(),
  categoria: z.string().optional(),
  data: z.coerce.date(),
  descricao: z.string().min(1),
  origem: z.enum(["manual", "pluggy"]).default("manual"),
});

export const transactionFiltersSchema = z.object({
  categoria: z.string().optional(),
  origem: z.enum(["manual", "pluggy"]).optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
export type TransactionFiltersDto = z.infer<typeof transactionFiltersSchema>;
```
