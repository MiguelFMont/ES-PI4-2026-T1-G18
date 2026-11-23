import { apiFetch } from '../../../core/http/api.js';

// Chamadas ao Backend para as contas do usuário (manuais e Open Finance) e a lista de bancos. Contrato: docs/contrato-api.md,
// seção 2.9. Não confundir com contasConectadasService.js (as conexões com a Pluggy, /connected-accounts).

/** Lista as contas do usuário (GET /accounts), cada uma com o `saldoAtual`. Devolve uma lista de Account. */
export function listarMinhasContas() {
  return apiFetch('/accounts');
}

/** Lista fixa de bancos do campo Banco (GET /accounts/banks). Devolve [{ codigo, nome }]. */
export function listarBancos() {
  return apiFetch('/accounts/banks');
}

/**
 * Cria uma conta (POST /accounts). `dados`: { nome, banco, tipo?, saldoInicial?, conectadaId? }. Conta Open Finance exige o
 * plano Pro (403 PLAN_REQUIRED) e a conexão (`conectadaId`). Devolve a conta criada.
 */
export function criarConta(dados) {
  return apiFetch('/accounts', { method: 'POST', body: JSON.stringify(dados) });
}

/** Altera nome, banco e/ou saldo inicial (PATCH /accounts/:id). O saldo de uma conta Open Finance não muda (422 ACCOUNT_READ_ONLY). */
export function atualizarConta(id, alteracoes) {
  return apiFetch(`/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(alteracoes) });
}

/**
 * Exclui a conta (DELETE /accounts/:id) com os cartões e os lançamentos dela. Resposta 200: { desfazerId, cartoes, lancamentos }; o desfazerId vale
 * por alguns minutos em desfazerExclusao.
 */
export function excluirConta(id) {
  return apiFetch(`/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Desfaz a última exclusão de conta ou de cartão (POST /undo/:id), trazendo de volta tudo o que saiu com ela. */
export function desfazerExclusao(desfazerId) {
  return apiFetch(`/undo/${encodeURIComponent(desfazerId)}`, { method: 'POST' });
}

/** O plano do usuário logado ('free' ou 'pro'), de GET /auth/me. Se a consulta falhar, vale 'free' (o Backend confere de qualquer jeito). */
export async function buscarPlano() {
  try {
    const usuario = await apiFetch('/auth/me');
    return usuario?.plano === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}
