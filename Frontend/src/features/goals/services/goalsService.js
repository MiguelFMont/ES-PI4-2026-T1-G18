import { apiFetch } from '../../../core/http/api.js';

// Chamadas ao Backend para as metas (docs/contrato-api.md, seção 5). O progresso de cada meta vem calculado: o Backend soma
// as transações reais do usuário e o Servidor Java faz a conta; aqui só se pede e se mostra.

/** Lista as metas do usuário (GET /goals), do prazo mais próximo para o mais distante. Devolve uma lista de Goal. */
export function listarMetas() {
  return apiFetch('/goals');
}

/**
 * Cria uma meta (POST /goals). `dados`: { titulo, valorObjetivo, prazo, valorInicial? }, com `prazo` como "AAAA-MM-DD".
 * Devolve a meta criada, já com o progresso. O progresso vem das transações que o usuário vincular a ela (ao cadastrar a
 * transação, com `metaId`).
 */
export function criarMeta(dados) {
  return apiFetch('/goals', { method: 'POST', body: JSON.stringify(dados) });
}

/** Edita uma meta (PATCH /goals/:id); só os campos enviados mudam. Devolve a meta com o progresso recalculado. */
export function atualizarMeta(id, alteracoes) {
  return apiFetch(`/goals/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(alteracoes) });
}

/** Exclui uma meta (DELETE /goals/:id). Resposta 204, sem corpo. As transações do usuário não são tocadas. */
export function excluirMeta(id) {
  return apiFetch(`/goals/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
