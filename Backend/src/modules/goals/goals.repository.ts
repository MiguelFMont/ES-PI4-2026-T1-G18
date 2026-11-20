// src/modules/goals/goals.repository.ts
import { GoalDocument, GoalModel } from "./goals.model";
import { TransactionModel } from "../transactions/transactions.model";

export interface Aportes {
  total: number;
  quantidade: number;
}

export const goalsRepository = {
  // Sempre filtrada por userId: nunca expor meta de um usuário para outro. Prazo mais próximo primeiro; as sem prazo no fim.
  async findByUser(userId: string) {
    const metas = await GoalModel.find({ userId }).sort({ prazo: 1, _id: 1 }).lean();
    return [...metas.filter((m) => m.prazo), ...metas.filter((m) => !m.prazo)];
  },

  // Uma meta do usuário (ou null se não existe ou é de outro usuário).
  async findOneByUser(userId: string, id: string) {
    return GoalModel.findOne({ _id: id, userId }).lean();
  },

  async create(dados: GoalDocument) {
    const meta = await GoalModel.create(dados);
    return meta.toObject();
  },

  // O filtro com o userId garante que só o dono altera. Devolve null se não existe ou é de outro usuário.
  // `prazo: null` tira o prazo da meta.
  async update(userId: string, id: string, alteracoes: Partial<Omit<GoalDocument, "prazo">> & { prazo?: Date | null }) {
    const { prazo, ...resto } = alteracoes;
    const operacao = prazo === null ? { $set: resto, $unset: { prazo: "" } } : { $set: { ...resto, ...(prazo && { prazo }) } };
    return GoalModel.findOneAndUpdate({ _id: id, userId }, operacao, { new: true, runValidators: true }).lean();
  },

  // Exclui a meta e DESVINCULA as transações dela (elas continuam no extrato, só deixam de apontar para uma meta que não
  // existe mais). Devolve false se a meta não existe ou é de outro usuário.
  async remove(userId: string, id: string): Promise<boolean> {
    const resultado = await GoalModel.deleteOne({ _id: id, userId });
    if (resultado.deletedCount === 0) return false;
    await TransactionModel.updateMany({ userId, metaId: id }, { $unset: { metaId: "" } });
    return true;
  },

  // O total e a quantidade das transações do usuário vinculadas a cada meta (chave: id da meta), até o instante `ate`.
  // Despesa vinculada SOMA (o usuário guardou o dinheiro) e receita vinculada SUBTRAI (retirou da meta): o total pode ficar
  // negativo se saiu mais do que entrou. Transações com data no futuro ainda não contam. Só lê a coleção do Grupo 2; a vinculação é feita por ela.
  async somarAportes(userId: string, ate: Date): Promise<Map<string, Aportes>> {
    const grupos = await TransactionModel.aggregate<{ _id: string; total: number; quantidade: number }>([
      { $match: { userId, metaId: { $type: "string" }, data: { $lte: ate } } },
      { $group: { _id: "$metaId", total: { $sum: { $cond: [{ $eq: ["$tipo", "receita"] }, { $multiply: ["$valor", -1] }, "$valor"] } }, quantidade: { $sum: 1 } } },
    ]);
    return new Map(grupos.map((g) => [g._id, { total: g.total, quantidade: g.quantidade }]));
  },
};
