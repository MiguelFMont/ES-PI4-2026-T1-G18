# goals.repository.ts — Acesso a dados de metas financeiras

## O que deve ter neste arquivo
- CRUD puro sobre a coleção `goals`, sempre filtrado por `userId`.

## Exemplo de implementação

```ts
// src/modules/goals/goals.repository.ts
import { GoalModel } from "./goals.model";
import { CreateGoalDto } from "./goals.dto";

export const goalsRepository = {
  async findByUser(userId: string) {
    return GoalModel.find({ userId }).lean();
  },

  async findByIdAndUser(userId: string, id: string) {
    return GoalModel.findOne({ _id: id, userId }).lean();
  },

  async create(dados: CreateGoalDto & { userId: string; valorAtual: number }) {
    const meta = await GoalModel.create(dados);
    return meta.toObject();
  },

  async updateByUser(userId: string, id: string, dados: Record<string, unknown>) {
    return GoalModel.findOneAndUpdate({ _id: id, userId }, dados, { new: true }).lean();
  },

  async deleteByUser(userId: string, id: string) {
    return GoalModel.deleteOne({ _id: id, userId });
  },
};
```
