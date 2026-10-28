// src/modules/mentor-ia/mentor-ia.repository.ts
import { ChatMessageModel } from "./mentor-ia.model";

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

  // As `limite` mensagens mais recentes do usuário, da mais antiga para a mais nova.
  async findRecent(userId: string, limite: number) {
    const docs = await ChatMessageModel.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limite)
      .lean();
    return docs.reverse();
  },
};
