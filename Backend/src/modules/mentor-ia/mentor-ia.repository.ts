// src/modules/mentor-ia/mentor-ia.repository.ts
import { AlertModel, ChatMessageModel } from "./mentor-ia.model";
import { AlertaCandidato, TransacaoParaAlerta } from "./alertas.regras";
import { TransactionModel } from "../transactions/transactions.model";

export const mentorIaRepository = {
  // Grava a pergunta e a resposta juntas, só depois de a IA responder: uma falha
  // da IA não deixa no histórico uma pergunta sem resposta.
  async saveExchange(userId: string, pergunta: string, resposta: string) {
    // mesmo createdAt: a ordem fica pelo _id, que é gerado em sequência
    const [p, r] = await ChatMessageModel.insertMany([
      { userId, autor: "usuario", texto: pergunta },
      { userId, autor: "ia", texto: resposta },
    ]);
    return [p.toObject(), r.toObject()] as const;
  },

  // Mensagem que o Mentor manda sem pergunta do usuário (explicação dos alertas).
  async saveMensagemProativa(userId: string, texto: string) {
    const m = await ChatMessageModel.create({ userId, autor: "ia", texto, proativa: true });
    return m.toObject();
  },

  // As `limite` mensagens mais recentes do usuário, da mais antiga para a mais nova.
  async findRecent(userId: string, limite: number) {
    const docs = await ChatMessageModel.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limite)
      .lean();
    return docs.reverse();
  },

  // Transações do usuário no período [inicio, fim), só com os campos que as regras de alerta usam.
  // O Mentor só lê a coleção do Grupo 2, nunca altera transações.
  async findTransacoesParaAlertas(userId: string, inicio: Date, fim: Date): Promise<TransacaoParaAlerta[]> {
    return TransactionModel.find({ userId, data: { $gte: inicio, $lt: fim } })
      .select({ _id: 0, tipo: 1, valor: 1, categoria: 1, data: 1, formaPagamento: 1 })
      .lean();
  },

  // Grava os alertas que valem agora (upsert pela chave: não duplica nem desfaz o "lido") e apaga
  // os não lidos que deixaram de valer. Os lidos ficam como histórico e não voltam a aparecer.
  async sincronizarAlertas(userId: string, alertas: AlertaCandidato[]) {
    if (alertas.length > 0) {
      await AlertModel.bulkWrite(
        alertas.map(({ chave, tipo, titulo, mensagem, dados }) => ({
          updateOne: {
            filter: { userId, chave },
            update: { $set: { tipo, titulo, mensagem, dados }, $setOnInsert: { lido: false } },
            upsert: true,
          },
        })),
        { ordered: false }
      );
    }
    await AlertModel.deleteMany({ userId, lido: false, chave: { $nin: alertas.map((a) => a.chave) } });
  },

  // Não lidos, mais recentes primeiro; `naoExplicados` deixa só os que o Mentor ainda não explicou no chat.
  async findAlertasNaoLidos(userId: string, naoExplicados = false) {
    return AlertModel.find({ userId, lido: false, ...(naoExplicados && { explicadoEm: { $exists: false } }) })
      .sort({ createdAt: -1, _id: -1 })
      .lean();
  },

  // null quando o alerta não existe ou não é do usuário
  async marcarAlertaComoLido(userId: string, id: string) {
    return AlertModel.findOneAndUpdate({ _id: id, userId }, { $set: { lido: true } }, { new: true }).lean();
  },

  async marcarAlertasComoExplicados(userId: string, ids: string[]) {
    if (ids.length === 0) return 0;
    const resultado = await AlertModel.updateMany(
      { _id: { $in: ids }, userId, explicadoEm: { $exists: false } },
      { $set: { explicadoEm: new Date() } }
    );
    return resultado.modifiedCount;
  },
};
