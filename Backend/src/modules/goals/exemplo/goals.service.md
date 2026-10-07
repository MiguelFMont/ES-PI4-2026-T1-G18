# goals.service.ts — Casos de uso de metas financeiras

## O que deve ter neste arquivo
- CRUD de metas e cálculo de progresso, tudo repassado ao Servidor Java: `PedidoListarMetas`, `PedidoCriarMeta`, `PedidoAtualizarMeta`, `PedidoRemoverMeta` e `PedidoProgressoMeta`.
- O Servidor é dono das metas (e do valor acumulado) e calcula o progresso (percentual concluído e se está dentro do prazo) lendo a própria meta; o Backend só envia `userId` (do token) e `id`.
- Meta inexistente ou de outro usuário volta como `Erro` `404` e vira `AppError`.

## Exemplo de implementação

```ts
// src/modules/goals/goals.service.ts
import { javaServerClient } from "../../java-client/java-server.client";
import { CreateGoalDto } from "./goals.dto";

type Meta = { id: string; titulo: string; valorObjetivo: number; valorAtual: number; prazo: string };

export const goalsService = {
  async list(userId: string) {
    const { metas } = await javaServerClient.enviarPedido<{ userId: string }, { metas: Meta[] }>(
      "PedidoListarMetas",
      "RespostaListarMetas",
      { userId }
    );
    return metas;
  },

  async create(userId: string, dados: CreateGoalDto) {
    const { meta } = await javaServerClient.enviarPedido<unknown, { meta: Meta }>(
      "PedidoCriarMeta",
      "RespostaCriarMeta",
      { userId, ...dados }
    );
    return meta;
  },

  async update(userId: string, id: string, dados: Partial<CreateGoalDto>) {
    const { meta } = await javaServerClient.enviarPedido<unknown, { meta: Meta }>(
      "PedidoAtualizarMeta",
      "RespostaAtualizarMeta",
      { userId, id, ...dados }
    );
    return meta;
  },

  async remove(userId: string, id: string) {
    await javaServerClient.enviarPedido<unknown, { removida: boolean }>(
      "PedidoRemoverMeta",
      "RespostaRemoverMeta",
      { userId, id }
    );
  },

  getProgress(userId: string, id: string) {
    return javaServerClient.enviarPedido<
      { userId: string; id: string },
      { percentualConcluido: number; dentroDoPrazo: boolean }
    >("PedidoProgressoMeta", "RespostaProgressoMeta", { userId, id });
  },
};
```
