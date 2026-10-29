import { apiFetch } from '../../../core/http/api.js';

/**
 * Lista uma página de transações do usuário (GET /transactions).
 * `filtros` aceita pagina, limite, categoria, origem, dataInicio, dataFim, valorMin e valorMax;
 * valores vazios são ignorados. Resposta: { itens, pagina, limite, total, totalPaginas }.
 */
export function listarTransacoes(filtros = {}) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, String(valor));
  }
  const consulta = params.toString();
  return apiFetch(consulta ? `/transactions?${consulta}` : '/transactions');
}

/**
 * Cadastra uma transação (POST /transactions).
 * `dados`: { tipo, valor, data, descricao, categoria?, formaPagamento? }. Devolve a transação criada.
 */
export function criarTransacao(dados) {
  return apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

/**
 * Edita uma transação (PUT /transactions/:id). `dados` é o corpo completo, no mesmo formato de criarTransacao:
 * { tipo, valor, data, descricao, categoria, formaPagamento, observacoes? }. Devolve a transação atualizada.
 */
export function atualizarTransacao(id, dados) {
  return apiFetch(`/transactions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  });
}

/** Exclui uma transação (DELETE /transactions/:id). Não há exclusão em lote: a tela chama uma vez por transação. */
export function excluirTransacao(id) {
  return apiFetch(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
