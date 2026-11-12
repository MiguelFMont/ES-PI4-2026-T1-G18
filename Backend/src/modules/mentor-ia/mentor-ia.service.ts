// src/modules/mentor-ia/mentor-ia.service.ts
import { mentorIaRepository } from "./mentor-ia.repository";
import { ChatMessageDocument } from "./mentor-ia.model";
import { AlertResponseDto, ChatMessageResponseDto, ChatProativaResponseDto, ChatReplyResponseDto } from "./mentor-ia.dto";
import { chamarApiDeIaGenerativa } from "./genai.client";
import { alertasService } from "./alertas.service";
import { transactionsRepository } from "../transactions/transactions.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { mesAtualEmBrasilia } from "./datas";

// 100 é o máximo por página da listagem de transações.
const TRANSACOES_DO_MES = 100;
// mensagens anteriores no prompt: o limite gratuito do Groq é por tokens/minuto
const MENSAGENS_ANTERIORES = 6;
const MENSAGENS_NO_HISTORICO = 50;

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
    ...(m.proativa && { proativa: true as const }),
    criadaEm: m.createdAt.toISOString(),
  };
}

// Resumo do mês atual montado pelo Servidor Java (totais, % por categoria...): as transações
// não vão cruas para a IA.
async function montarContexto(userId: string): Promise<string> {
  const { inicio, diaDoMes } = mesAtualEmBrasilia();
  const { docs } = await transactionsRepository.findByUser(userId, {
    dataInicio: inicio,
    pagina: 1,
    limite: TRANSACOES_DO_MES,
  });

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
  return contexto;
}

// Remove as frases que recomendam um ativo específico (Servidor Java).
async function filtrarResposta(resposta: string): Promise<string> {
  const { respostaFiltrada } = await javaServerClient.enviarPedido<
    { resposta: string },
    { respostaFiltrada: string }
  >("PedidoFiltrarResposta", "RespostaFiltrarResposta", { resposta });
  return respostaFiltrada;
}

// Os alertas entram no resumo (e não só na instrução): os números deles são calculados pelo Backend
// (alertas.regras.ts), e a IA só cita números que estão no resumo.
function contextoComPadroes(contexto: string, alertas: AlertResponseDto[]): string {
  const padroes = alertas.map((a) => `- ${a.titulo}: ${a.mensagem}`).join("\n");
  return `${contexto}\n\nPadrões identificados nas transações (números já calculados, podem ser citados):\n${padroes}`;
}

// Instrução interna da mensagem proativa: vai para a IA no lugar da pergunta, mas não é salva no histórico.
const INSTRUCAO_PROATIVA = [
  "[Instrução interna: o usuário não escreveu esta mensagem, ele acabou de abrir o chat.]",
  "Comece a conversa explicando, de forma amigável e educativa, só os padrões identificados no fim do resumo,",
  "com os números deles e o que cada um significa para o orçamento; não descreva o resto do resumo.",
  "Use no máximo 2 parágrafos curtos ou uma lista curta e termine com uma pergunta ou um convite para o usuário continuar a conversa.",
  "Nunca recomende um ativo específico.",
].join(" ");

export const mentorIaService = {
  // contexto (Servidor Java) -> IA (Backend) -> filtro (Servidor Java) -> histórico (MongoDB)
  async sendMessage(userId: string, texto: string): Promise<ChatReplyResponseDto> {
    const [contexto, anteriores] = await Promise.all([
      montarContexto(userId),
      mentorIaRepository.findRecent(userId, MENSAGENS_ANTERIORES),
    ]);

    const respostaFiltrada = await filtrarResposta(await chamarApiDeIaGenerativa(contexto, texto, anteriores));

    const [pergunta, resposta] = await mentorIaRepository.saveExchange(userId, texto, respostaFiltrada);
    return { pergunta: paraDto(pergunta), resposta: paraDto(resposta) };
  },

  // O Mentor inicia a conversa explicando os alertas que ainda não explicou. Sem alerta novo, não
  // chama a IA nem o Servidor Java e devolve []. Se a IA ou o filtro falharem, nada é salvo e os
  // alertas continuam sem explicação (tenta de novo na próxima abertura do chat).
  async proactiveMessage(userId: string): Promise<ChatProativaResponseDto> {
    const alertas = await alertasService.listarNaoExplicados(userId);
    if (alertas.length === 0) return { mensagens: [] };

    // Sem histórico no prompt: a instrução se basta e gasta menos tokens do limite gratuito.
    const contexto = contextoComPadroes(await montarContexto(userId), alertas);
    const texto = await filtrarResposta(await chamarApiDeIaGenerativa(contexto, INSTRUCAO_PROATIVA));

    // Marca antes de salvar: só os ainda não explicados são marcados (update atômico). Se outra aba
    // explicou os mesmos alertas enquanto a IA respondia, nenhum é marcado aqui e a mensagem é
    // descartada, sem duplicar a explicação no chat.
    const marcados = await alertasService.marcarComoExplicados(userId, alertas.map((a) => a.id));
    if (marcados === 0) return { mensagens: [] };

    const mensagem = await mentorIaRepository.saveMensagemProativa(userId, texto);
    return { mensagens: [paraDto(mensagem)] };
  },

  async getHistory(userId: string): Promise<ChatMessageResponseDto[]> {
    const mensagens = await mentorIaRepository.findRecent(userId, MENSAGENS_NO_HISTORICO);
    return mensagens.map(paraDto);
  },
};
