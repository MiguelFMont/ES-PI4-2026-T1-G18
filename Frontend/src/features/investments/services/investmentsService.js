import { apiFetch } from '../../../core/http/api.js';

// Chamadas ao Backend para os cartões de crédito SIMULADOS (o portfólio e os parcelamentos manuais têm rotas no Backend, mas ficaram sem tela; as compras parceladas se fazem em Transações) (docs/contrato-api.md, seção 6). Valor atual, rendimento,
// parcela, saldo devedor e fatura vêm calculados: o Servidor Java faz as contas e o Backend usa as transações reais do usuário.

// ---------------------------------------------------------------- cartão

/** Cartões do usuário (GET /investments/cards): { cartoes: [Card] }, o mais antigo (o padrão) primeiro, cada um com a sua fatura. */
export function listarCartoes() {
  return apiFetch('/investments/cards');
}

/** Cria um cartão (POST /investments/cards). `dados`: { nome, contaId, limite?, diaFechamento? }: todo cartão é vinculado a uma conta do usuário. Devolve o cartão criado. */
export function criarCartao(dados) {
  return apiFetch('/investments/cards', { method: 'POST', body: JSON.stringify(dados) });
}

/** Altera o nome, o limite e/ou o dia de fechamento da fatura de um cartão (PATCH /investments/cards/:id). Devolve o cartão recalculado. */
export function atualizarCartao(id, alteracoes) {
  return apiFetch(`/investments/cards/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(alteracoes) });
}

/** Exclui um cartão com os lançamentos e os parcelamentos dele (DELETE /investments/cards/:id). Resposta 200: { desfazerId, lancamentos }. */
export function excluirCartao(id) {
  return apiFetch(`/investments/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
