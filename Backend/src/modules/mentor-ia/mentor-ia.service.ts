// src/modules/mentor-ia/mentor-ia.service.ts
import { mentorIaRepository } from "./mentor-ia.repository";
import { ChatMessageDocument } from "./mentor-ia.model";
import { ChatMessageResponseDto, ChatReplyResponseDto } from "./mentor-ia.dto";
import { chamarApiDeIaGenerativa } from "./genai.client";
import { transactionsRepository } from "../transactions/transactions.repository";
import { javaServerClient } from "../../java-client/java-server.client";

// O Servidor Java resume as transações do mês (totais, % por categoria...), então elas não
// vão cruas para a IA. 100 é o máximo por página da listagem de transações.
const TRANSACOES_DO_MES = 100;
// mensagens anteriores no prompt: o limite gratuito do Groq é por tokens/minuto
const MENSAGENS_ANTERIORES = 6;
const MENSAGENS_NO_HISTORICO = 50;

// O mês do usuário é o de Brasília (UTC-3, sem horário de verão desde 2019), não o do servidor.
const FUSO_BRASILIA_MS = 3 * 60 * 60 * 1000;

function mesAtualEmBrasilia() {
  const agora = new Date(Date.now() - FUSO_BRASILIA_MS); // campos UTC = data/hora de Brasília
  return {
    inicio: new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1) + FUSO_BRASILIA_MS),
    diaDoMes: agora.getUTCDate(),
  };
}

interface TransacaoResumida {
  tipo: "receita" | "despesa";
  valor: number;
  categoria: string;
  descricao: string;
  data: string;
}

function paraDto(m: ChatMessageDocument & { _id: { toString(): string } }): ChatMessageResponseDto {
  return {
    id: m._id.toString(),
    autor: m.autor,
    texto: m.texto,
    criadaEm: m.createdAt.toISOString(),
  };
}

export const mentorIaService = {
  // contexto (Servidor Java) -> IA (Backend) -> filtro (Servidor Java) -> histórico (MongoDB)
  async sendMessage(userId: string, texto: string): Promise<ChatReplyResponseDto> {
    const { inicio, diaDoMes } = mesAtualEmBrasilia();
    const [{ docs }, anteriores] = await Promise.all([
      transactionsRepository.findByUser(userId, { dataInicio: inicio, pagina: 1, limite: TRANSACOES_DO_MES }),
      mentorIaRepository.findRecent(userId, MENSAGENS_ANTERIORES),
    ]);

    // só o necessário para o contexto: sem userId nem dados da conta
    const transacoes: TransacaoResumida[] = docs.map((t) => ({
      tipo: t.tipo,
      valor: t.valor,
      categoria: t.categoria,
      descricao: t.descricao,
      data: t.data.toISOString(),
    }));

    const { contexto } = await javaServerClient.enviarPedido<
      { diaDoMes: number; transacoes: TransacaoResumida[] },
      { contexto: string }
    >("PedidoMontarContextoIA", "RespostaMontarContextoIA", { diaDoMes, transacoes });

    const respostaBruta = await chamarApiDeIaGenerativa(contexto, texto, anteriores);

    const { respostaFiltrada } = await javaServerClient.enviarPedido<
      { resposta: string },
      { respostaFiltrada: string }
    >("PedidoFiltrarResposta", "RespostaFiltrarResposta", { resposta: respostaBruta });

    const [pergunta, resposta] = await mentorIaRepository.saveExchange(userId, texto, respostaFiltrada);
    return { pergunta: paraDto(pergunta), resposta: paraDto(resposta) };
  },

  async getHistory(userId: string): Promise<ChatMessageResponseDto[]> {
    const mensagens = await mentorIaRepository.findRecent(userId, MENSAGENS_NO_HISTORICO);
    return mensagens.map(paraDto);
  },
};
