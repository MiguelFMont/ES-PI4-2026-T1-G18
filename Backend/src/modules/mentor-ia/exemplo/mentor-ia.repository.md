# mentor-ia.repository.ts — Acesso a dados do chat e dos alertas

## O que deve ter neste arquivo
- `saveChatMessage`/`findHistory`: grava e lista as mensagens trocadas entre usuário e IA, sempre filtradas por `userId`.
- `saveAlert`/`findAlerts`: grava e lista os alertas gerados para o usuário (o que gera o alerta em si não é responsabilidade deste arquivo, só a persistência).

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.repository.ts
import { ChatMessageModel, AlertModel } from "./mentor-ia.model";
import { TransactionModel } from "../transactions/transactions.model";

export const mentorIaRepository = {
  async saveChatMessage(userId: string, autor: "usuario" | "ia", texto: string) {
    const mensagem = await ChatMessageModel.create({ userId, autor, texto });
    return mensagem.toObject();
  },

  async findHistory(userId: string) {
    return ChatMessageModel.find({ userId }).sort({ createdAt: 1 }).lean();
  },

  async saveAlert(userId: string, tipo: string, mensagem: string) {
    const alerta = await AlertModel.create({ userId, tipo, mensagem, lida: false });
    return alerta.toObject();
  },

  async findAlerts(userId: string) {
    return AlertModel.find({ userId }).sort({ createdAt: -1 }).lean();
  },

  async getResumoFinanceiro(userId: string) {
    const transacoes = await TransactionModel.find({ userId }).sort({ data: -1 }).limit(10).lean();
    const soma = (tipo: string) =>
      transacoes.filter((t) => t.tipo === tipo).reduce((total, t) => total + t.valor, 0);

    return {
      receitas: soma("receita"),
      despesas: soma("despesa"),
      transacoesRecentes: transacoes.map((t) => ({ descricao: t.descricao, valor: t.valor })),
    };
  },
};
```
