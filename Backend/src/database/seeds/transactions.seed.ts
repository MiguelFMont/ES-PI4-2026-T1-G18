// src/database/seeds/transactions.seed.ts
//
// Insere transações de exemplo (últimos ~3 meses) para um usuário, para desenvolver e
// demonstrar a listagem, os filtros e o painel sem digitar tudo à mão.
//
// Uso (a partir da pasta Backend, com MONGO_URI no .env):
//   npm run seed:transacoes                       -> usuário "usuario-demo"
//   npm run seed:transacoes -- <userId>           -> para um usuário específico
//   npm run seed:transacoes -- <userId> --limpar  -> apaga ANTES as transações desse usuário
//
// As datas são relativas a hoje, então sempre há movimento no mês atual.
import mongoose from "mongoose";
import { connectDatabase } from "../mongo.connection";
import { env } from "../../config/env";
import { TransactionDocument, TransactionModel } from "../../modules/transactions/transactions.model";

type Exemplo = Omit<TransactionDocument, "userId" | "data" | "origem"> & { diasAtras: number };

const R = "receita" as const;
const D = "despesa" as const;

const EXEMPLOS: Exemplo[] = [
  // receitas
  { tipo: R, valor: 4500, categoria: "Salario", descricao: "Salário", formaPagamento: "pix", diasAtras: 2 },
  { tipo: R, valor: 4500, categoria: "Salario", descricao: "Salário", formaPagamento: "pix", diasAtras: 32 },
  { tipo: R, valor: 4500, categoria: "Salario", descricao: "Salário", formaPagamento: "pix", diasAtras: 62 },
  { tipo: R, valor: 850, categoria: "Outros", descricao: "Freelance site", formaPagamento: "pix", diasAtras: 15 },
  { tipo: R, valor: 1200, categoria: "Outros", descricao: "Freelance app", formaPagamento: "pix", diasAtras: 47 },
  { tipo: R, valor: 120, categoria: "Outros", descricao: "Reembolso", formaPagamento: "pix", diasAtras: 20 },
  // moradia
  { tipo: D, valor: 1400, categoria: "Moradia", descricao: "Aluguel", formaPagamento: "boleto", diasAtras: 5 },
  { tipo: D, valor: 1400, categoria: "Moradia", descricao: "Aluguel", formaPagamento: "boleto", diasAtras: 35 },
  { tipo: D, valor: 1400, categoria: "Moradia", descricao: "Aluguel", formaPagamento: "boleto", diasAtras: 65 },
  // alimentação
  { tipo: D, valor: 312.45, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 1 },
  { tipo: D, valor: 189.9, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 8 },
  { tipo: D, valor: 254.3, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 16 },
  { tipo: D, valor: 301.1, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 38 },
  { tipo: D, valor: 220.75, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 46 },
  { tipo: D, valor: 278.6, categoria: "Alimentacao", descricao: "Supermercado", formaPagamento: "debito", diasAtras: 70 },
  { tipo: D, valor: 68.5, categoria: "Alimentacao", descricao: "Restaurante", formaPagamento: "credito", diasAtras: 4 },
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

function dataDaquiAtras(dias: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - dias);
  return d;
}

async function main() {
  const args = process.argv.slice(2);
  const limpar = args.includes("--limpar");
  const userId = args.find((a) => !a.startsWith("--")) ?? "usuario-demo";

  if (!(await connectDatabase())) {
    console.error("MONGO_URI não definida no .env: não há banco para popular.");
    process.exit(1);
  }

  if (limpar) {
    const { deletedCount } = await TransactionModel.deleteMany({ userId });
    console.log(`[seed] ${deletedCount} transações antigas de "${userId}" removidas`);
  }

  const docs = EXEMPLOS.map(({ diasAtras, ...resto }) => ({
    ...resto,
    userId,
    data: dataDaquiAtras(diasAtras),
    origem: "manual" as const,
  }));
  await TransactionModel.insertMany(docs);

  const receitas = docs.filter((d) => d.tipo === "receita").length;
  console.log(
    `[seed] ${docs.length} transações inseridas para "${userId}" no banco "${env.MONGO_DB}" ` +
      `(${receitas} receitas, ${docs.length - receitas} despesas)`
  );
  await mongoose.disconnect();
}

main().catch(async (erro) => {
  console.error("[seed] falhou:", erro instanceof Error ? erro.message : erro);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
