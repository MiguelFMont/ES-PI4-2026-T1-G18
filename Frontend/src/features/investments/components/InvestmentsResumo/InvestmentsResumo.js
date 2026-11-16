import { formatarMoeda, formatarPercentual } from '../../../../shared/utils/moeda.js';

/** Cor do número: verde se for ganho, vermelho se for perda, neutro se for zero. */
function colorir(elemento, valor) {
  elemento.classList.toggle('investments-positivo', valor > 0);
  elemento.classList.toggle('investments-negativo', valor < 0);
}

/**
 * Liga o resumo do patrimônio (HTML em InvestmentsResumo.html). Devolve { atualizar(carteira) }, com a resposta de
 * GET /investments ({ totalInvestido, patrimonio, rendimento, rentabilidade, ... }).
 */
export function iniciarResumo(raiz) {
  const patrimonio = raiz.querySelector('#invest-patrimonio');
  const investido = raiz.querySelector('#invest-investido');
  const rendimento = raiz.querySelector('#invest-rendimento');
  const rentabilidade = raiz.querySelector('#invest-rentabilidade');

  return {
    atualizar(carteira) {
      patrimonio.textContent = formatarMoeda(carteira.patrimonio);
      investido.textContent = formatarMoeda(carteira.totalInvestido);
      rendimento.textContent = formatarMoeda(carteira.rendimento);
      rentabilidade.textContent = formatarPercentual(carteira.rentabilidade);
      colorir(rendimento, carteira.rendimento);
      colorir(rentabilidade, carteira.rentabilidade);
    },
  };
}
