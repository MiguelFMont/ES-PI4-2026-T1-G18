import { formatarMoeda } from '../../utils/format.js';

/**
 * Liga a lógica ao resumo (HTML em TransactionResumo.html). `atualizar(resumo)` recebe o campo `resumo`
 * da resposta de GET /transactions: { receitas, despesas, saldo }, que vale para todas as páginas
 * que passam nos filtros, não só para a que está na tela.
 */
export function iniciarResumo(raiz) {
  const entradas = raiz.querySelector('#resumo-entradas');
  const saidas = raiz.querySelector('#resumo-saidas');
  const saldo = raiz.querySelector('#resumo-saldo');

  return {
    atualizar(resumo) {
      entradas.textContent = formatarMoeda(resumo.receitas);
      saidas.textContent = formatarMoeda(resumo.despesas);
      saldo.textContent = formatarMoeda(resumo.saldo);
      saldo.className = resumo.saldo < 0 ? 'transactions-resumo__valor--despesa' : 'transactions-resumo__valor--receita';
    },
  };
}
