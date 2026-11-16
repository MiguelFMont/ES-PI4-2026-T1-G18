import { apiFetch } from '../../../core/http/api.js';

// Chamadas ao Backend para os investimentos e o cartão SIMULADOS (docs/contrato-api.md, seção 6). Valor atual, rendimento,
// parcela, saldo devedor e fatura vêm calculados: o Servidor Java faz as contas e o Backend usa as transações reais do usuário.

// ---------------------------------------------------------------- portfólio

/** Portfólio e patrimônio (GET /investments): { ativos, totalInvestido, patrimonio, rendimento, rentabilidade }. */
export function obterCarteira() {
  return apiFetch('/investments');
}

/**
 * Cadastra um ativo simulado (POST /investments). `dados`: { nome, tipo, valorInvestido, taxaMensal?, dataAplicacao? }, com
 * `dataAplicacao` como "AAAA-MM-DD". Devolve o ativo criado, já com o valor atual.
 */
export function criarAtivo(dados) {
  return apiFetch('/investments', { method: 'POST', body: JSON.stringify(dados) });
}

/** Remove um ativo (DELETE /investments/:id). Resposta 204, sem corpo. */
export function excluirAtivo(id) {
  return apiFetch(`/investments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------- cartão

/** Cartão simulado (GET /investments/card): limite, limite disponível e a fatura do mês com o vencimento. */
export function obterCartao() {
  return apiFetch('/investments/card');
}

/** Altera o limite e/ou o dia de vencimento (PATCH /investments/card). Devolve o cartão recalculado. */
export function atualizarCartao(alteracoes) {
  return apiFetch('/investments/card', { method: 'PATCH', body: JSON.stringify(alteracoes) });
}

// ---------------------------------------------------------------- parcelamentos

/** Parcelamentos ativos e os totais (GET /investments/card/installments). */
export function listarParcelamentos() {
  return apiFetch('/investments/card/installments');
}

/** Cadastra um parcelamento (POST ...). `dados`: { descricao, valorTotal, parcelas, parcelasPagas?, taxaJurosMensal? }. */
export function criarParcelamento(dados) {
  return apiFetch('/investments/card/installments', { method: 'POST', body: JSON.stringify(dados) });
}

/** Edita a descrição ou quantas parcelas já foram pagas (PATCH .../:id). Devolve o parcelamento recalculado. */
export function atualizarParcelamento(id, alteracoes) {
  return apiFetch(`/investments/card/installments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(alteracoes) });
}

/** Remove um parcelamento (DELETE .../:id). Resposta 204, sem corpo. */
export function excluirParcelamento(id) {
  return apiFetch(`/investments/card/installments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
