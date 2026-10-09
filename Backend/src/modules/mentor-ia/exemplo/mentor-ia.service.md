# mentor-ia.service.ts — Regras de negócio do mentor financeiro

## O que deve ter neste arquivo
- `sendMessage`: (1) lê os dados financeiros do usuário no MongoDB (totais do mês e transações recentes) e os manda ao Servidor Java, que monta o contexto resumido (`PedidoMontarContextoIA`); (2) chama a API externa de IA generativa com esse contexto + a mensagem do usuário (**no Backend**, fora do escopo deste exemplo: um client HTTP separado, com `GENAI_API_KEY`); (3) manda a resposta da IA ao Servidor Java para filtrar (`PedidoFiltrarResposta`): a restrição de nunca recomendar compra/venda de ativo específico é garantida no Java, sem depender só do prompt; (4) salva a troca no histórico.
- `getHistory`/`listAlerts`: leitura simples via `mentorIaRepository`.
- Os alertas (gasto fora do padrão, fatura próxima, dinheiro parado) são gerados por um processo fora do escopo deste arquivo (por exemplo, um job agendado ou o fluxo do chat; **a definir pelo grupo**); este service só lê e expõe o que já foi salvo.

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.service.ts
import { mentorIaRepository } from "./mentor-ia.repository";
import { dashboardRepository } from "../dashboard/dashboard.repository";
import { transactionsRepository } from "../transactions/transactions.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { chamarApiDeIaGenerativa } from "./genai.client"; // fora do escopo deste exemplo

export const mentorIaService = {
  async sendMessage(userId: string, texto: string) {
    const { receitas, despesas } = await dashboardRepository.getTotaisDoMes(userId);
    const recentes = await transactionsRepository.findRecentByUser(userId, 5);

    const { contexto } = await javaServerClient.enviarPedido<
      { userId: string; receitas: number; despesas: number; transacoesRecentes: unknown[] },
      { contexto: string }
    >("PedidoMontarContextoIA", "RespostaMontarContextoIA", {
      userId,
      receitas,
      despesas,
      transacoesRecentes: recentes,
    });

    const respostaBruta = await chamarApiDeIaGenerativa(contexto, texto);

    const { respostaFiltrada } = await javaServerClient.enviarPedido<
      { resposta: string },
      { respostaFiltrada: string }
    >("PedidoFiltrarResposta", "RespostaFiltrarResposta", { resposta: respostaBruta });

    await mentorIaRepository.saveChatMessage(userId, "usuario", texto);
    await mentorIaRepository.saveChatMessage(userId, "ia", respostaFiltrada);

    return { resposta: respostaFiltrada };
  },

  async getHistory(userId: string) {
    return mentorIaRepository.findHistory(userId);
  },

  async listAlerts(userId: string) {
    return mentorIaRepository.findAlerts(userId);
  },
};
```
