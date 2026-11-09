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
import { TransactionModel } from "../../modules/transactions/transactions.model";
import { EXEMPLOS, dataDaquiAtras } from "./transactions.seed.dados";

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
