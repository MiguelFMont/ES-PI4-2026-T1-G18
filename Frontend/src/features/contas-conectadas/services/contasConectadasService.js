import { apiFetch } from '../../../core/http/api.js';

// Chamadas ao Backend para as contas conectadas (Open Finance, sandbox da Pluggy). Contrato: docs/contrato-api.md, seção 2.8.
// Só o Backend fala com a Pluggy: a chave dela nunca chega aqui, só o token temporário do widget.

/** Lista as contas conectadas do usuário (GET /connected-accounts). Devolve uma lista de ConnectedAccount. */
export function listarContas() {
  return apiFetch('/connected-accounts');
}

/**
 * Conecta o banco de teste "Pluggy Bank" sem widget (POST /connected-accounts/sandbox) e já importa as transações.
 * Leva de 20 a 30 segundos. Devolve { conta, importacao, avisoImportacao? }; se a importação falhar, `importacao` vem
 * null e `avisoImportacao` explica, mas a conta fica conectada.
 */
export function conectarSandbox() {
  return apiFetch('/connected-accounts/sandbox', { method: 'POST' });
}

/** Pede o token temporário para abrir o widget Pluggy Connect (POST /connected-accounts/connect-token). Devolve { accessToken }. */
export function criarConnectToken() {
  return apiFetch('/connected-accounts/connect-token', { method: 'POST' });
}

/** Registra o item criado pelo widget e já importa (POST /connected-accounts). Mesma resposta de conectarSandbox. */
export function registrarItem(itemId) {
  return apiFetch('/connected-accounts', { method: 'POST', body: JSON.stringify({ itemId }) });
}

/** Importa de novo as transações de uma conta (POST /connected-accounts/:id/sync). Devolve { lidas, importadas, ignoradas }. */
export function sincronizarConta(id) {
  return apiFetch(`/connected-accounts/${encodeURIComponent(id)}/sync`, { method: 'POST' });
}

/** Desconecta a conta (DELETE /connected-accounts/:id). As transações já importadas continuam. Resposta 204, sem corpo. */
export function desconectarConta(id) {
  return apiFetch(`/connected-accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
