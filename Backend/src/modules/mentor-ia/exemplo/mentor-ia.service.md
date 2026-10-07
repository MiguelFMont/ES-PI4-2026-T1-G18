# mentor-ia.service.ts — Casos de uso do mentor financeiro

## O que deve ter neste arquivo
- `sendMessage` orquestra quatro passos, e é o único service que combina o Servidor Java com um serviço externo:
  1. `PedidoMontarContextoIA`: o Servidor lê as transações do usuário no banco e devolve um texto de contexto pronto para o prompt;
  2. chamada à **API de IA generativa** (cliente HTTP externo, `genai.client`, fora do escopo deste exemplo): fica no Backend, que é quem tem a `GENAI_API_KEY` e acesso à internet;
  3. `PedidoFiltrarResposta`: o Servidor aplica a regra de segurança do grupo (nunca recomendar compra ou venda de ativo específico);
  4. `PedidoSalvarTrocaChat`: o Servidor grava a pergunta e a resposta filtrada no histórico.
- `getHistory` e `listAlerts`: leituras repassadas ao Servidor (`PedidoHistoricoChat`, `PedidoListarAlertas`).
- A geração dos alertas (gasto fora do padrão, fatura próxima, dinheiro parado) é feita no Servidor, fora deste arquivo; o Backend só consulta.

## Exemplo de implementação

```ts
// src/modules/mentor-ia/mentor-ia.service.ts
import { javaServerClient } from "../../java-client/java-server.client";
import { chamarApiDeIaGenerativa } from "./genai.client"; // fora do escopo deste exemplo

export const mentorIaService = {
  async sendMessage(userId: string, texto: string) {
    const { contexto } = await javaServerClient.enviarPedido<{ userId: string }, { contexto: string }>(
      "PedidoMontarContextoIA",
      "RespostaMontarContextoIA",
      { userId }
    );

    const respostaBruta = await chamarApiDeIaGenerativa(contexto, texto);

    const { respostaFiltrada } = await javaServerClient.enviarPedido<
      { resposta: string },
      { respostaFiltrada: string }
    >("PedidoFiltrarResposta", "RespostaFiltrarResposta", { resposta: respostaBruta });

    await javaServerClient.enviarPedido(
      "PedidoSalvarTrocaChat",
      "RespostaSalvarTrocaChat",
      { userId, mensagemUsuario: texto, respostaIA: respostaFiltrada }
    );

    return { resposta: respostaFiltrada };
  },

  async getHistory(userId: string) {
    const { mensagens } = await javaServerClient.enviarPedido<{ userId: string }, { mensagens: unknown[] }>(
      "PedidoHistoricoChat",
      "RespostaHistoricoChat",
      { userId }
    );
    return mensagens;
  },

  async listAlerts(userId: string) {
    const { alertas } = await javaServerClient.enviarPedido<{ userId: string }, { alertas: unknown[] }>(
      "PedidoListarAlertas",
      "RespostaListarAlertas",
      { userId }
    );
    return alertas;
  },
};
```
