# investments.dto.ts — Contratos de saída de investimentos

## O que deve ter neste arquivo
- Esse módulo é majoritariamente leitura (painel simulado + parcelamentos já existentes), então aqui ficam só os tipos de resposta, não schemas de validação de entrada.

## Exemplo de implementação

```ts
// src/modules/investments/investments.dto.ts
export interface PortfolioDto {
  patrimonioTotal: number;
  ativos: Array<{ nome: string; valor: number; rentabilidade: number }>;
}

export interface InstallmentDto {
  descricao: string;
  parcelaAtual: number;
  totalParcelas: number;
  valorMensal: number;
}
```
