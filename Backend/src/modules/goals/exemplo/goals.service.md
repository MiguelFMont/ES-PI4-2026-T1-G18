# goals.service.ts — Regras de negócio de metas financeiras

## O que deve ter neste arquivo
- `create`/`update`/`remove`/`list`: CRUD no MongoDB pelo `goalsRepository`, sempre restrito ao `userId`.
- `getProgress`: pede ao Servidor Java (`PedidoProgressoMeta`) o cálculo do progresso atual da meta. O Java decide a fórmula (percentual e se está dentro do prazo); o service só envia o valor atual, o objetivo e o prazo da meta e devolve o que o Java calcular.

## Exemplo de implementação

```ts
// src/modules/goals/goals.service.ts
import { goalsRepository } from "./goals.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";
import { CreateGoalDto } from "./goals.dto";

export const goalsService = {
  async list(userId: string) {
    return goalsRepository.findByUser(userId);
  },

  async create(userId: string, dados: CreateGoalDto) {
    return goalsRepository.create({ ...dados, userId, valorAtual: 0 });
  },

  async update(userId: string, id: string, dados: Partial<CreateGoalDto>) {
    const meta = await goalsRepository.updateByUser(userId, id, dados);
    if (!meta) {
      throw new AppError("Meta não encontrada", 404, "GOAL_NOT_FOUND");
    }
    return meta;
  },

  async remove(userId: string, id: string) {
    await goalsRepository.deleteByUser(userId, id);
  },

  async getProgress(userId: string, id: string) {
    const meta = await goalsRepository.findByIdAndUser(userId, id);
    if (!meta) {
      throw new AppError("Meta não encontrada", 404, "GOAL_NOT_FOUND");
    }

    return javaServerClient.enviarPedido<
      { valorAtual: number; valorObjetivo: number; prazo: string },
      { percentualConcluido: number; dentroDoPrazo: boolean }
    >("PedidoProgressoMeta", "RespostaProgressoMeta", {
      valorAtual: meta.valorAtual,
      valorObjetivo: meta.valorObjetivo,
      prazo: new Date(meta.prazo).toISOString(),
    });
  },
};
```
