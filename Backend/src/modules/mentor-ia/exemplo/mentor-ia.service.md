# mentor-ia.service.ts — Regras de negócio do mentor financeiro

## O que deve ter neste arquivo
- `sendMessage`: (1) pede ao Servidor Java o contexto financeiro resumido do usuário (`PedidoMontarContextoIA` — o Backend envia os totais e as transações recentes, já que o Java não acessa o MongoDB, e o Java devolve um resumo pronto para virar prompt); (2) chama a API externa de IA generativa com esse contexto + a mensagem do usuário (fora do escopo deste exemplo, seria um client HTTP separado); (3) manda a resposta da IA para o Servidor Java filtrar (`PedidoFiltrarResposta`) a restrição de nunca recomendar compra/venda de ativo específico é garantida aqui, não confiando só no prompt; (4) salva a troca no histórico.
- `getHistory`/`listAlerts`: leitura simples via `mentorIaRepository`.
- Os alertas (gasto fora do padrão, fatura próxima, dinheiro parado) são gerados por um processo assíncrono fora do escopo deste arquivo (ex.: um job agendado) este service só lê e expõe o que já foi salvo em `mentor-ia.model.ts`.

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.service.ts
import { mentorIaRepository } from "./mentor-ia.repository";
import { JavaServerClient } from "../../java-client/java-server.client";
import { chamarApiDeIaGenerativa } from "./genai.client"; // fora do escopo deste exemplo

export const mentorIaService = {
  async sendMessage(userId: string, texto: string, java: JavaServerClient) {
    const resumo = await mentorIaRepository.getResumoFinanceiro(userId);

    const { contexto } = await java.enviarPedido<
      { userId: string; receitas: number; despesas: number; transacoesRecentes: unknown[] },
      { contexto: string }
    >("PedidoMontarContextoIA", "RespostaMontarContextoIA", { userId, ...resumo });

    const respostaBruta = await chamarApiDeIaGenerativa(contexto, texto);

    const { respostaFiltrada } = await java.enviarPedido<
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
