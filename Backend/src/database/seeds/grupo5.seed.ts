// src/database/seeds/grupo5.seed.ts
//
// Insere dados de exemplo do Grupo 5 (metas com os aportes vinculados, portfólio simulado, cartão e parcelamentos) para um
// usuário, para desenvolver e demonstrar as telas sem cadastrar tudo à mão. Os aportes das metas são TRANSAÇÕES (despesas
// com `metaId`) e a fatura do cartão soma as despesas no crédito do mês: para ver a fatura com compras, rode também
// `npm run seed:transacoes` (com o mesmo usuário).
//
// Uso (a partir da pasta Backend, com MONGO_URI no .env):
//   npm run seed:grupo5                       -> usuário "usuario-demo"
//   npm run seed:grupo5 -- <userId>           -> para um usuário específico
//   npm run seed:grupo5 -- <userId> --limpar  -> apaga ANTES as metas desse usuário (e as transações vinculadas a elas),
//                                                os ativos, o cartão e os parcelamentos
//
// As datas são relativas a hoje.
import mongoose from "mongoose";
import { connectDatabase } from "../mongo.connection";
import { env } from "../../config/env";
import { GoalModel } from "../../modules/goals/goals.model";
import {
  CARTAO_PADRAO,
  CardInstallmentModel,
  CardModel,
  InvestmentModel,
  NOME_CARTAO_PADRAO,
  chaveDoNome,
} from "../../modules/investments/investments.model";
import { TransactionModel } from "../../modules/transactions/transactions.model";

const hoje = () => {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
};
const emDias = (dias: number) => new Date(hoje().getTime() + dias * 86_400_000);
// `n` meses atrás, no mesmo dia (limitado ao 28, que existe em todo mês)
const mesesAtras = (n: number) => {
  const h = hoje();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - n, Math.min(h.getUTCDate(), 28)));
};

async function main() {
  const args = process.argv.slice(2);
  const limpar = args.includes("--limpar");
  const userId = args.find((a) => !a.startsWith("--")) ?? "usuario-demo";

  if (!(await connectDatabase())) {
    console.error("MONGO_URI não definida no .env: não há banco para popular.");
    process.exit(1);
  }

  if (limpar) {
    // as transações vinculadas às metas (os aportes) vão junto com elas
    const idsDasMetas = (await GoalModel.find({ userId }).select("_id").lean()).map((m) => m._id.toString());
    const { deletedCount: aportes } = await TransactionModel.deleteMany({ userId, metaId: { $in: idsDasMetas } });
    console.log(`[seed] ${aportes} aportes (transações vinculadas a metas) de "${userId}" removidos`);

    const [metas, ativos, parcelamentos] = await Promise.all([
      GoalModel.deleteMany({ userId }),
      InvestmentModel.deleteMany({ userId }),
      CardInstallmentModel.deleteMany({ userId }),
    ]);
    await CardModel.deleteMany({ userId });
    console.log(
      `[seed] removidos de "${userId}": ${metas.deletedCount} metas, ${ativos.deletedCount} ativos, ${parcelamentos.deletedCount} parcelamentos`
    );
  }

  const [reserva, viagem, notebook] = await GoalModel.insertMany([
    { userId, titulo: "Reserva de emergência", valorObjetivo: 15000, valorInicial: 3000, prazo: emDias(300) },
    { userId, titulo: "Viagem de fim de ano", valorObjetivo: 6000, valorInicial: 0, prazo: emDias(75) },
    { userId, titulo: "Notebook novo", valorObjetivo: 4500, valorInicial: 1000, prazo: emDias(20) },
  ]);

  // Os aportes: despesas (o dinheiro que saiu da conta para ser guardado) vinculadas a cada meta.
  const aporte = (meta: { _id: unknown; titulo: string }, valor: number, diasAtras: number) => ({
    userId,
    tipo: "despesa" as const,
    valor,
    categoria: "Outros",
    data: emDias(-diasAtras),
    descricao: `Aporte: ${meta.titulo}`,
    formaPagamento: "pix" as const,
    origem: "manual" as const,
    metaId: String(meta._id),
  });
  await TransactionModel.insertMany([
    aporte(reserva, 1500, 75), aporte(reserva, 1200, 45), aporte(reserva, 2000, 12),
    aporte(viagem, 800, 40), aporte(viagem, 1200, 20), aporte(viagem, 450, 5),
    aporte(notebook, 1500, 30), aporte(notebook, 2000, 8),
  ]);

  await InvestmentModel.insertMany([
    { userId, nome: "CDB Banco Digital 110% CDI", tipo: "renda_fixa", valorInvestido: 5000, taxaMensal: 0.95, dataAplicacao: mesesAtras(8) },
    { userId, nome: "Tesouro Selic", tipo: "renda_fixa", valorInvestido: 3000, taxaMensal: 0.85, dataAplicacao: mesesAtras(5) },
    { userId, nome: "Fundo de ações (simulado)", tipo: "fundo", valorInvestido: 2000, taxaMensal: 1.4, dataAplicacao: mesesAtras(4) },
    { userId, nome: "Carteira cripto (simulada)", tipo: "cripto", valorInvestido: 800, taxaMensal: -2.5, dataAplicacao: mesesAtras(3) },
  ]);

  // o cartão padrão do usuário (o mais antigo)
  const chavePadrao = chaveDoNome(NOME_CARTAO_PADRAO);
  await CardModel.updateOne(
    { userId, nomeChave: chavePadrao },
    { $set: { ...CARTAO_PADRAO, limite: 8000 }, $setOnInsert: { nome: NOME_CARTAO_PADRAO } },
    { upsert: true }
  );
  const cartao = await CardModel.findOne({ userId, nomeChave: chavePadrao }).lean();
  const cartaoId = String(cartao?._id);
  await CardInstallmentModel.insertMany([
    { userId, cartaoId, descricao: "Notebook (12x)", valorTotal: 4500, parcelas: 12, parcelasPagas: 4, taxaJurosMensal: 0 },
    { userId, cartaoId, descricao: "Geladeira (10x com juros)", valorTotal: 3200, parcelas: 10, parcelasPagas: 2, taxaJurosMensal: 1.99 },
    { userId, cartaoId, descricao: "Curso de inglês (6x)", valorTotal: 1800, parcelas: 6, parcelasPagas: 5, taxaJurosMensal: 0 },
  ]);

  console.log(`[seed] metas, ativos, cartão e parcelamentos inseridos para "${userId}" no banco "${env.MONGO_DB}"`);
}

main()
  .catch((erro) => {
    console.error("[seed] falhou:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
