// src/modules/mentor-ia/alertas.service.ts
// Os alertas são gerados quando o usuário os lê (GET /alerts), com as transações reais dele: assim não
// dependem de gancho no cadastro de transações (Grupo 2) nem de job agendado, e refletem edições e
// exclusões feitas desde a última leitura. As regras ficam em alertas.regras.ts.
import { mentorIaRepository } from "./mentor-ia.repository";
import { AlertDocument } from "./mentor-ia.model";
import { AlertResponseDto } from "./mentor-ia.dto";
import { gerarAlertas, periodoDoHistorico } from "./alertas.regras";
import { AppError } from "../../shared/errors/app-error";

function paraDto(a: AlertDocument & { _id: { toString(): string } }): AlertResponseDto {
  return {
    id: a._id.toString(),
    tipo: a.tipo,
    titulo: a.titulo,
    mensagem: a.mensagem,
    dados: a.dados,
    lido: a.lido,
    criadaEm: a.createdAt.toISOString(),
  };
}

export const alertasService = {
  // Recalcula os alertas do usuário para hoje e grava o resultado (sem duplicar os que já existem).
  async atualizar(userId: string, agora = new Date()): Promise<void> {
    const { inicio, fim } = periodoDoHistorico(agora);
    const transacoes = await mentorIaRepository.findTransacoesParaAlertas(userId, inicio, fim);
    await mentorIaRepository.sincronizarAlertas(userId, gerarAlertas(transacoes, agora));
  },

  // Alertas não lidos, mais recentes primeiro (já atualizados).
  async listar(userId: string): Promise<AlertResponseDto[]> {
    await alertasService.atualizar(userId);
    return (await mentorIaRepository.findAlertasNaoLidos(userId)).map(paraDto);
  },

  async marcarComoLido(userId: string, id: string): Promise<AlertResponseDto> {
    const alerta = await mentorIaRepository.marcarAlertaComoLido(userId, id);
    if (!alerta) throw new AppError("Alerta não encontrado", 404, "ALERT_NOT_FOUND");
    return paraDto(alerta);
  },

  // Para as explicações proativas no chat: não lidos que o Mentor ainda não explicou (já atualizados).
  async listarNaoExplicados(userId: string): Promise<AlertResponseDto[]> {
    await alertasService.atualizar(userId);
    return (await mentorIaRepository.findAlertasNaoLidos(userId, true)).map(paraDto);
  },

  // Marca `explicadoEm` para o alerta não ser explicado de novo. Devolve quantos foram marcados.
  async marcarComoExplicados(userId: string, ids: string[]): Promise<number> {
    return mentorIaRepository.marcarAlertasComoExplicados(userId, ids);
  },
};
