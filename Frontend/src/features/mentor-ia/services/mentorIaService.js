import { apiFetch } from '../../../core/http/api.js';

/**
 * Histórico do chat (GET /mentor-ia/chat): as últimas 50 mensagens do usuário, da mais antiga para a mais nova.
 * Cada mensagem: { id, autor: 'usuario' | 'ia', texto, criadaEm }; as explicações que o Mentor mandou sem pergunta
 * (ver buscarExplicacaoProativa) vêm também com `proativa: true`. Sem conversa, devolve [].
 */
export function buscarHistorico({ signal } = {}) {
  return apiFetch('/mentor-ia/chat', { signal });
}

/**
 * Envia uma pergunta ao Mentor (POST /mentor-ia/chat). `texto` tem de 1 a 2000 caracteres.
 * Demora alguns segundos (até 20). Devolve { pergunta, resposta }, as duas já salvas no histórico;
 * se der erro, nada é salvo.
 */
export function enviarMensagem(texto) {
  return apiFetch('/mentor-ia/chat', {
    method: 'POST',
    body: JSON.stringify({ texto }),
  });
}

/**
 * Pede ao Mentor uma explicação sem pergunta do usuário (POST /mentor-ia/chat/proativa, sem corpo), para abrir a
 * conversa com um insight sobre os gastos. Devolve { mensagens }: [] quando não há padrão novo que valha comentar
 * (nem chega a chamar a IA); senão, uma mensagem { id, autor: 'ia', texto, criadaEm, proativa: true }, já salva no
 * histórico. Pode demorar como uma resposta do chat (até 20 s) e falha com os mesmos erros de enviarMensagem.
 */
export function buscarExplicacaoProativa({ signal } = {}) {
  return apiFetch('/mentor-ia/chat/proativa', { method: 'POST', signal });
}

/**
 * Alertas não lidos (GET /mentor-ia/alerts), dos mais recentes para os mais antigos. Cada alerta:
 * { id, tipo: 'gasto_fora_do_padrao' | 'fatura_proxima' | 'dinheiro_parado', titulo, mensagem, dados, lido, criadaEm }.
 * `mensagem` já vem pronta para mostrar (valores formatados). Sem alertas, devolve [].
 */
export function buscarAlertas({ signal } = {}) {
  return apiFetch('/mentor-ia/alerts', { signal });
}

/**
 * Marca um alerta como lido (PATCH /mentor-ia/alerts/:id/lido, sem corpo): ele sai da listagem e não volta no mesmo
 * período. Devolve o alerta com `lido: true`.
 */
export function marcarAlertaComoLido(id) {
  return apiFetch(`/mentor-ia/alerts/${encodeURIComponent(id)}/lido`, { method: 'PATCH' });
}
