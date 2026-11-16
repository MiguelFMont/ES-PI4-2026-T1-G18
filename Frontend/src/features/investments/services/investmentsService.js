import { apiFetch } from '../../../core/http/api.js';

// Chamadas ao Backend para o cartão de crédito SIMULADO (o portfólio de investimentos tem rotas no Backend, mas ficou sem tela) (docs/contrato-api.md, seção 6). Valor atual, rendimento,
// parcela, saldo devedor e fatura vêm calculados: o Servidor Java faz as contas e o Backend usa as transações reais do usuário.

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
