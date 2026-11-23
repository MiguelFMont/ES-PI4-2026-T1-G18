// src/modules/investments/investments.repository.ts
import {
  CARTAO_PADRAO,
  CardDocument,
  CardInstallmentModel,
  CardModel,
  InstallmentDocument,
  InvestmentDocument,
  InvestmentModel,
  NOME_CARTAO_PADRAO,
  chaveDoNome,
} from "./investments.model";
import { TransactionModel } from "../transactions/transactions.model";

// Valores iniciais do cartão criado sozinho (continua exportado daqui para o seed).
export { CARTAO_PADRAO };

// Compras no crédito do período, somadas por cartão (`cartaoId` null = compras sem cartão indicado).
export interface ComprasDoCartao {
  cartaoId: string | null;
  total: number;
}

// Filtro dos parcelamentos de um cartão: o cartão mais antigo (padrão) também fica com os parcelamentos antigos, de
// antes de existir cartaoId.
const doCartao = (cartaoId: string, ehPadrao: boolean) =>
  ehPadrao ? { $or: [{ cartaoId }, { cartaoId: { $exists: false } }] } : { cartaoId };

// Tudo é filtrado por userId: nunca expor dado de um usuário para outro.
export const investmentsRepository = {
  // ---------------------------------------------------------------- portfólio
  async findInvestments(userId: string) {
    return InvestmentModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async createInvestment(dados: InvestmentDocument) {
    return (await InvestmentModel.create(dados)).toObject();
  },

  async removeInvestment(userId: string, id: string): Promise<boolean> {
    return (await InvestmentModel.deleteOne({ _id: id, userId })).deletedCount > 0;
  },

  // ---------------------------------------------------------------- cartões
  // Do mais antigo (o padrão) para o mais novo.
  async findCards(userId: string) {
    return CardModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async findCard(userId: string, id: string) {
    return CardModel.findOne({ _id: id, userId }).lean();
  },

  async countCards(userId: string): Promise<number> {
    return CardModel.countDocuments({ userId });
  },

  // O cartão do usuário com este nome (sem diferenciar maiúsculas), se houver; `exceto` ignora um cartão (na edição).
  async findCardByName(userId: string, nome: string, exceto?: string) {
    return CardModel.findOne({ userId, nomeChave: chaveDoNome(nome), ...(exceto && { _id: { $ne: exceto } }) }).lean();
  },

  // Quem não tem cartão recebe um chamado "Cartão", com os valores padrão (upsert atômico: duas chamadas juntas não criam
  // dois; a que perde a corrida cai no índice único e é ignorada).
  async ensureDefaultCard(userId: string): Promise<void> {
    if (await CardModel.exists({ userId })) return;
    try {
      await CardModel.updateOne(
        { userId, nomeChave: chaveDoNome(NOME_CARTAO_PADRAO) },
        { $setOnInsert: { nome: NOME_CARTAO_PADRAO, ...CARTAO_PADRAO } },
        { upsert: true }
      );
    } catch (erro: any) {
      if (erro?.code !== 11000) throw erro;
    }
  },

  // O cartão mais antigo, ou null se o usuário não tem nenhum (não se cria mais um cartão sozinho: a conexão com o Open Finance é
  // opcional, então ninguém é obrigado a ter cartão).
  async findOldestCard(userId: string) {
    return CardModel.findOne({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  // Quantos cartões estão vinculados a uma conta (a conta com cartão não se exclui).
  // O cartão mais antigo de uma conta (cartões antigos, sem conta, valem para qualquer conta), ou null.
  async findOldestCardOfConta(userId: string, contaId: string) {
    return CardModel.findOne({ userId, $or: [{ contaId }, { contaId: { $exists: false } }] })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
  },

  async countCardsByConta(userId: string, contaId: string): Promise<number> {
    return CardModel.countDocuments({ userId, contaId });
  },

  // Exclui cartões com tudo o que é deles: os lançamentos no cartão e os parcelamentos (em andamento ou não). `cartoes` leva o id e se o cartão
  // é o mais antigo (que também fica com os parcelamentos antigos, sem cartaoId). Devolve o que saiu, para o desfazer.
  async excluirCartoesComTudo(userId: string, cartoes: { id: string; ehPadrao: boolean }[]) {
    const ids = cartoes.map((c) => c.id);
    const docsCartoes = await CardModel.find({ userId, _id: { $in: ids } }).lean();
    const parcelamentos = (await Promise.all(cartoes.map((c) => CardInstallmentModel.find({ userId, ...doCartao(c.id, c.ehPadrao) }).lean()))).flat();
    const transacoes = await TransactionModel.find({ userId, cartaoId: { $in: ids } }).lean();
    if (transacoes.length > 0) await TransactionModel.deleteMany({ _id: { $in: transacoes.map((t) => t._id) } });
    if (parcelamentos.length > 0) await CardInstallmentModel.deleteMany({ _id: { $in: parcelamentos.map((p) => p._id) } });
    await CardModel.deleteMany({ userId, _id: { $in: ids } });
    return { cartoes: docsCartoes, parcelamentos, transacoes };
  },

  // Desfazer: os cartões, os parcelamentos e os lançamentos voltam com os mesmos ids.
  async restaurarCartoes(saida: { cartoes: unknown[]; parcelamentos: unknown[]; transacoes: unknown[] }) {
    if (saida.cartoes.length > 0) await CardModel.collection.insertMany(saida.cartoes as never[]);
    if (saida.parcelamentos.length > 0) await CardInstallmentModel.collection.insertMany(saida.parcelamentos as never[]);
    if (saida.transacoes.length > 0) await TransactionModel.collection.insertMany(saida.transacoes as never[]);
  },

  // O cartão mais antigo do usuário (o padrão), sem criar nada.
  async idDoCartaoMaisAntigo(userId: string): Promise<string | undefined> {
    const doc = await CardModel.findOne({ userId }).sort({ createdAt: 1, _id: 1 }).select("_id").lean();
    return doc ? String(doc._id) : undefined;
  },

  // Os cartões vinculados a uma conta (para excluí-los junto com ela).
  async findCardsByConta(userId: string, contaId: string) {
    return CardModel.find({ userId, contaId }).lean();
  },

  async findCardByPluggyAccount(userId: string, pluggyAccountId: string) {
    return CardModel.findOne({ userId, pluggyAccountId }).lean();
  },

  async createCard(dados: Pick<CardDocument, "userId" | "nome" | "limite" | "diaFechamento" | "contaId" | "pluggyAccountId">) {
    return (await CardModel.create({ ...dados, nomeChave: chaveDoNome(dados.nome) })).toObject();
  },

  async updateCard(userId: string, id: string, alteracoes: Partial<Pick<CardDocument, "nome" | "limite" | "diaFechamento" | "contaId">> & { icone?: string | null; cor?: string | null }) {
    const { nome, ...resto } = alteracoes;
    const set = { ...resto, ...(nome !== undefined && { nome: nome.trim(), nomeChave: chaveDoNome(nome) }) };
    return CardModel.findOneAndUpdate({ _id: id, userId }, { $set: set }, { new: true, runValidators: true }).lean();
  },

  // Ao desconectar o Open Finance a conta vira manual, e os cartões dela também (deixam de ser da Pluggy e voltam a poder ser editados e excluídos).
  async soltarCartoesDaConta(userId: string, contaId: string) {
    await CardModel.updateMany({ userId, contaId }, { $unset: { pluggyAccountId: "" } });
  },

  // Quantos parcelamentos do cartão ainda não foram quitados (isso impede a exclusão do cartão).
  async countActiveInstallments(userId: string, cartaoId: string, ehPadrao: boolean): Promise<number> {
    return CardInstallmentModel.countDocuments({
      userId,
      $expr: { $lt: ["$parcelasPagas", "$parcelas"] },
      ...doCartao(cartaoId, ehPadrao),
    });
  },

  // Quantas transações (compras no crédito, inclusive as parceladas) estão vinculadas ao cartão: com lançamentos, o cartão não se exclui.
  async countTransactionsOfCard(userId: string, cartaoId: string): Promise<number> {
    return TransactionModel.countDocuments({ userId, cartaoId });
  },

  // Exclui o cartão. Sem parcelamentos ativos nem lançamentos (quem chama já conferiu), os parcelamentos quitados saem junto.
  async removeCard(userId: string, cartaoId: string, ehPadrao: boolean): Promise<boolean> {
    const { deletedCount } = await CardModel.deleteOne({ _id: cartaoId, userId });
    if (deletedCount === 0) return false;
    await CardInstallmentModel.deleteMany({ userId, ...doCartao(cartaoId, ehPadrao) });
    return true;
  },

  // Despesas reais pagas no crédito no período [de, ate], somadas por cartão: a parte "compras" das faturas. As compras
  // PARCELADAS (com parcelamentoId) ficam de fora: a fatura conta as parcelas do parcelamento, nunca as duas coisas. Só
  // lê a coleção do Grupo 2, nunca altera.
  async somarComprasNoCredito(userId: string, de: Date, ate: Date): Promise<ComprasDoCartao[]> {
    const grupos = await TransactionModel.aggregate<{ _id: string | null; total: number }>([
      {
        $match: {
          userId,
          tipo: { $in: ["despesa", "receita"] }, // a receita no cartão (estorno) abate a fatura
          formaPagamento: "credito",
          parcelamentoId: { $exists: false },
          data: { $gte: de, $lte: ate },
        },
      },
      { $group: { _id: "$cartaoId", total: { $sum: { $cond: [{ $eq: ["$tipo", "despesa"] }, "$valor", { $multiply: ["$valor", -1] }] } } } },
    ]);
    return grupos.map((g) => ({ cartaoId: g._id ?? null, total: g.total }));
  },

  // ---------------------------------------------------------------- parcelamentos
  async findInstallments(userId: string) {
    return CardInstallmentModel.find({ userId }).sort({ createdAt: 1, _id: 1 }).lean();
  },

  async findInstallment(userId: string, id: string) {
    return CardInstallmentModel.findOne({ _id: id, userId }).lean();
  },

  async findInstallmentsByIds(userId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return CardInstallmentModel.find({ userId, _id: { $in: ids } }).lean();
  },

  async createInstallment(dados: InstallmentDocument) {
    return (await CardInstallmentModel.create(dados)).toObject();
  },

  async updateInstallment(userId: string, id: string, alteracoes: Partial<InstallmentDocument>) {
    return CardInstallmentModel.findOneAndUpdate({ _id: id, userId }, { $set: alteracoes }, { new: true, runValidators: true }).lean();
  },

  async removeInstallment(userId: string, id: string): Promise<boolean> {
    return (await CardInstallmentModel.deleteOne({ _id: id, userId })).deletedCount > 0;
  },

  // Para o desfazer de uma exclusão de lançamentos: os parcelamentos saem e voltam com os mesmos ids.
  async restaurarParcelamentos(docs: unknown[]) {
    if (docs.length > 0) await CardInstallmentModel.collection.insertMany(docs as never[]);
  },

  async removeInstallments(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return (await CardInstallmentModel.deleteMany({ _id: { $in: ids }, userId })).deletedCount;
  },

  // De cada parcelamento (dos ids pedidos) que nasceu de uma compra: o id da transação.
  async transacoesDosParcelamentos(userId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const docs = await TransactionModel.find({ userId, parcelamentoId: { $in: ids } }).select("parcelamentoId").lean();
    return new Map(docs.map((d) => [d.parcelamentoId as string, d._id.toString()]));
  },

  // De cada parcelamento (dos ids pedidos) que nasceu de uma compra: a data da compra (de onde as parcelas começam a correr).
  async datasDasCompras(userId: string, ids: string[]): Promise<Map<string, Date>> {
    if (ids.length === 0) return new Map();
    const docs = await TransactionModel.find({ userId, parcelamentoId: { $in: ids } }).select("parcelamentoId data").lean();
    return new Map(docs.map((d) => [d.parcelamentoId as string, d.data as Date]));
  },

  // ---------------------------------------------------------------- migração
  // Idempotente; roda quando o Backend sobe (server.ts). Traz os dados do tempo de "um cartão por usuário":
  //  1. remove o índice único antigo por userId (impediria o segundo cartão);
  //  2. dá o nome padrão aos cartões antigos (sem nome): cada usuário continua com o seu cartão, com o mesmo limite e
  //     vencimento, agora chamado "Cartão";
  //  3. troca o dia do vencimento (modelo antigo) pelo dia do fechamento: o fechamento é 7 dias antes do vencimento;
  //  4. liga ao cartão mais antigo do usuário os parcelamentos antigos (sem cartaoId).
  // As transações antigas em crédito não mudam: sem cartaoId, contam para o cartão mais antigo, como antes.
  async migrarCartoes(): Promise<void> {
    const indices = await CardModel.collection.indexes().catch(() => []);
    if (indices.some((i) => i.name === "userId_1" && i.unique)) {
      await CardModel.collection.dropIndex("userId_1");
    }
    await CardModel.updateMany(
      { nome: { $exists: false } },
      { $set: { nome: NOME_CARTAO_PADRAO, nomeChave: chaveDoNome(NOME_CARTAO_PADRAO) } }
    );
    // diaFechamento = diaVencimento - 7 (dentro de 1 a 28: vencimento até o dia 7 fecha no fim do mês anterior, dia 22 a 28)
    await CardModel.collection.updateMany({ diaFechamento: { $exists: false }, diaVencimento: { $exists: true } }, [
      { $set: { diaFechamento: { $cond: [{ $gt: ["$diaVencimento", 7] }, { $subtract: ["$diaVencimento", 7] }, { $add: ["$diaVencimento", 21] }] } } },
      { $unset: "diaVencimento" },
    ]);
    await CardModel.createIndexes();

    const donos: string[] = await CardInstallmentModel.distinct("userId", { cartaoId: { $exists: false } });
    for (const userId of donos) {
      const maisAntigo = await investmentsRepository.findOldestCard(userId);
      if (maisAntigo) {
        await CardInstallmentModel.updateMany(
          { userId, cartaoId: { $exists: false } },
          { $set: { cartaoId: maisAntigo._id.toString() } }
        );
      }
    }
  },
};
