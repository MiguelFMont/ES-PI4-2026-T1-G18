// src/database/seeds/transactions.seed.dados.ts
//
// Os dados do seed de transações (transactions.seed.ts), separados do script para poderem ser
// importados sem conectar ao banco: os testes do Mentor IA usam estes exemplos para conferir que as
// regras de alerta não geram "gasto fora do padrão" com o seed em nenhum dia do ano.
import type { TransactionDocument } from "../../modules/transactions/transactions.model";

export type Exemplo = Omit<TransactionDocument, "userId" | "data" | "origem"> & { diasAtras: number };

const R = "receita" as const;
const D = "despesa" as const;

export const EXEMPLOS: Exemplo[] = [
  // receitas
  { tipo: R, valor: 4500, categoria: "Salario", descricao: "Salário", observacoes: "Salário de outubro", formaPagamento: "pix", diasAtras: 2 },
  { tipo: R, valor: 4500, categoria: "Salario", descricao: "Salário", formaPagamento: "pix", diasAtras: 32 },
  { tipo: R, valor: 4500, categoria: "Salario", descricao: "Salário", formaPagamento: "pix", diasAtras: 62 },
  { tipo: R, valor: 850, categoria: "Outros", descricao: "Freelance site", observacoes: "Pagamento da 1ª parcela", formaPagamento: "pix", diasAtras: 15 },
  { tipo: R, valor: 1200, categoria: "Outros", descricao: "Freelance app", formaPagamento: "pix", diasAtras: 47 },
  { tipo: R, valor: 120, categoria: "Outros", descricao: "Reembolso", formaPagamento: "pix", diasAtras: 20 },
  // moradia
  { tipo: D, valor: 1400, categoria: "Moradia", descricao: "Aluguel", observacoes: "Vence todo dia 5", formaPagamento: "boleto", diasAtras: 5 },
  { tipo: D, valor: 1400, categoria: "Moradia", descricao: "Aluguel", formaPagamento: "boleto", diasAtras: 35 },
  { tipo: D, valor: 1400, categoria: "Moradia", descricao: "Aluguel", formaPagamento: "boleto", diasAtras: 65 },
  // alimentação
  { tipo: D, valor: 312.45, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 1 },
  { tipo: D, valor: 189.9, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 8 },
  { tipo: D, valor: 254.3, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 16 },
  { tipo: D, valor: 301.1, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 38 },
  { tipo: D, valor: 220.75, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 46 },
  { tipo: D, valor: 278.6, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 70 },
  { tipo: D, valor: 68.5, categoria: "Alimentacao", descricao: "Restaurante", observacoes: "Almoço com a equipe", formaPagamento: "credito", diasAtras: 4 },
  { tipo: D, valor: 92, categoria: "Alimentacao", descricao: "Restaurante", formaPagamento: "credito", diasAtras: 12 },
  { tipo: D, valor: 54.9, categoria: "Alimentacao", descricao: "Restaurante", formaPagamento: "credito", diasAtras: 40 },
  // transporte
  { tipo: D, valor: 24.9, categoria: "Transporte", descricao: "Uber", formaPagamento: "credito", diasAtras: 3 },
  { tipo: D, valor: 31.5, categoria: "Transporte", descricao: "Uber", formaPagamento: "credito", diasAtras: 9 },
  { tipo: D, valor: 18.4, categoria: "Transporte", descricao: "Uber", formaPagamento: "credito", diasAtras: 27 },
  { tipo: D, valor: 22, categoria: "Transporte", descricao: "Uber", formaPagamento: "credito", diasAtras: 44 },
  { tipo: D, valor: 27.8, categoria: "Transporte", descricao: "Uber", formaPagamento: "credito", diasAtras: 75 },
  { tipo: D, valor: 200, categoria: "Transporte", descricao: "Combustível", formaPagamento: "debito", diasAtras: 10 },
  { tipo: D, valor: 190, categoria: "Transporte", descricao: "Combustível", formaPagamento: "debito", diasAtras: 41 },
  // saúde
  { tipo: D, valor: 57.3, categoria: "Saude", descricao: "Farmácia", formaPagamento: "debito", diasAtras: 6 },
  { tipo: D, valor: 89.9, categoria: "Saude", descricao: "Farmácia", formaPagamento: "pix", diasAtras: 52 },
  // lazer e educação
  { tipo: D, valor: 39.9, categoria: "Lazer", descricao: "Streaming", formaPagamento: "credito", diasAtras: 7 },
  { tipo: D, valor: 39.9, categoria: "Lazer", descricao: "Streaming", formaPagamento: "credito", diasAtras: 37 },
  { tipo: D, valor: 39.9, categoria: "Lazer", descricao: "Streaming", formaPagamento: "credito", diasAtras: 67 },
  { tipo: D, valor: 64, categoria: "Lazer", descricao: "Cinema", formaPagamento: "credito", diasAtras: 18 },
  { tipo: D, valor: 149, categoria: "Educacao", descricao: "Curso online", formaPagamento: "credito", diasAtras: 22 },
  { tipo: D, valor: 120, categoria: "Outros", descricao: "Presente de aniversário", formaPagamento: "dinheiro", diasAtras: 30 },
];

// Meio-dia (no fuso da máquina que roda o seed) de `dias` dias atrás.
export function dataDaquiAtras(dias: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d;
}
