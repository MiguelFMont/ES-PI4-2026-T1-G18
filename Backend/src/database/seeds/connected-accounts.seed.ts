// src/database/seeds/connected-accounts.seed.ts
//
// Insere contas conectadas de exemplo para um usuário, para desenvolver a tela de contas conectadas sem passar pela Pluggy.
// São registros de mentira: os ids de item não existem na Pluggy, então desconectar funciona (a Pluggy responde 404 e a conta
// local é removida), mas sincronizar uma conta do seed dá 404 PLUGGY_NOT_FOUND. Para contas de verdade, use
// POST /v1/connected-accounts/sandbox.
//
// Uso (a partir da pasta Backend, com MONGO_URI no .env):
//   npm run seed:contas                       -> usuário "usuario-demo"
//   npm run seed:contas -- <userId>           -> para um usuário específico
//   npm run seed:contas -- <userId> --limpar  -> apaga ANTES as contas conectadas desse usuário
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectDatabase } from "../mongo.connection";
import { env } from "../../config/env";
import { ConnectedAccountModel } from "../../modules/connected-accounts/connected-accounts.model";

async function main() {
  const args = process.argv.slice(2);
  const limpar = args.includes("--limpar");
  const userId = args.find((a) => !a.startsWith("--")) ?? "usuario-demo";

  if (!(await connectDatabase())) {
    console.error("MONGO_URI não definida no .env: não há banco para popular.");
    process.exit(1);
  }

  if (limpar) {
    const { deletedCount } = await ConnectedAccountModel.deleteMany({ userId });
    console.log(`[seed] ${deletedCount} contas conectadas antigas de "${userId}" removidas`);
  }

  const agora = new Date();
  const docs = [
    {
      userId,
      pluggyItemId: randomUUID(),
      connectorId: 2,
      instituicao: "Pluggy Bank",
      status: "UPDATED",
      contas: [
        { pluggyAccountId: randomUUID(), tipo: "BANK", nome: "Conta Corrente", saldo: 43701.43, moeda: "BRL" },
        { pluggyAccountId: randomUUID(), tipo: "CREDIT", nome: "Mastercard Black", saldo: -916.3, moeda: "BRL" },
      ],
      ultimaSincronizacao: agora,
    },
    {
      userId,
      pluggyItemId: randomUUID(),
      connectorId: 8,
      instituicao: "Pluggy Bank Business",
      status: "LOGIN_ERROR", // uma conexão que precisa ser refeita, para a tela mostrar esse estado
      contas: [{ pluggyAccountId: randomUUID(), tipo: "BANK", nome: "Conta Empresarial", saldo: 12000, moeda: "BRL" }],
    },
  ];
  await ConnectedAccountModel.insertMany(docs);

  console.log(`[seed] ${docs.length} contas conectadas inseridas para "${userId}" no banco "${env.MONGO_DB}"`);
  await mongoose.disconnect();
}

main().catch(async (erro) => {
  console.error("[seed] falhou:", erro instanceof Error ? erro.message : erro);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
