# dashboard.dto.ts — Contratos de saída do painel

## O que deve ter neste arquivo
- Tipos de resposta das rotas do painel (o painel não recebe payload de criação, então aqui só ficam os tipos de saída, não schemas de validação de entrada).

## Exemplo de implementação

```ts
// src/modules/dashboard/dashboard.dto.ts
export interface DashboardSummaryDto {
  receitas: number;
  despesas: number;
  saldo: number;
  economia: number;
  fluxoDeCaixa: number;
}

export interface CategoryBreakdownDto {
  categoria: string;
  total: number;
}
```
