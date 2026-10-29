import { apiFetch } from '../../../core/http/api.js';

/**
 * Histórico do chat (GET /mentor-ia/chat): as últimas 50 mensagens do usuário, da mais antiga para a mais nova.
 * Cada mensagem: { id, autor: 'usuario' | 'ia', texto, criadaEm }. Sem conversa, devolve [].
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
