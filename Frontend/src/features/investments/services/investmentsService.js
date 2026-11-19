import { apiFetch } from '../../../core/http/api.js';

// Chamadas ao Backend para o cartão de crédito SIMULADO (o portfólio de investimentos tem rotas no Backend, mas ficou sem tela) (docs/contrato-api.md, seção 6). Valor atual, rendimento,
// parcela, saldo devedor e fatura vêm calculados: o Servidor Java faz as contas e o Backend usa as transações reais do usuário.

// ---------------------------------------------------------------- cartão

/** Cartões do usuário (GET /investments/cards): { cartoes: [Card] }, o mais antigo (o padrão) primeiro, cada um com a sua fatura. */
export function listarCartoes() {
  return apiFetch('/investments/cards');
}

/** Cria um cartão (POST /investments/cards). `dados`: { nome, limite?, diaVencimento? }. Devolve o cartão criado. */
export function criarCartao(dados) {
  return apiFetch('/investments/cards', { method: 'POST', body: JSON.stringify(dados) });
}

/** Altera o nome, o limite e/ou o dia de vencimento de um cartão (PATCH /investments/cards/:id). Devolve o cartão recalculado. */
export function atualizarCartao(id, alteracoes) {
  return apiFetch(`/investments/cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(alteracoes) });
}

/** Exclui um cartão (DELETE /investments/cards/:id). As transações dele ficam, sem o vínculo. Resposta 204, sem corpo. */
export function excluirCartao(id) {
  return apiFetch(`/investments/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------- parcelamentos

/** Parcelamentos e os totais (GET /investments/card/installments); com `cartaoId`, só os desse cartão. */
export function listarParcelamentos(cartaoId) {
  return apiFetch(cartaoId ? `/investments/card/installments?cartaoId=${encodeURIComponent(cartaoId)}` : '/investments/card/installments');
}

/** Cadastra um parcelamento (POST ...). `dados`: { cartaoId?, descricao, valorTotal, parcelas, parcelasPagas?, taxaJurosMensal? }. */
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
