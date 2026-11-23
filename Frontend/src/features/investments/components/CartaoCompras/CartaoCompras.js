import { listarTransacoes } from '../../../transactions/services/transactionsService.js';
import { formatarMoeda } from '../../../../shared/utils/moeda.js';
import { aplicarLogo } from '../../utils/logo.js';

const POR_VEZ = 100; // só para somar os totais de um mês que não é o atual (a lista de lançamentos é a das Transações, paginada)
const DIAS_DO_FECHAMENTO_AO_VENCIMENTO = 7; // o mesmo do Backend (a fatura vence 7 dias depois de fechar)
const MES_EM_TEXTO = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });

const doisDigitos = (n) => String(n).padStart(2, '0');
const mesAtualDe = (agora = new Date()) => ({ ano: agora.getFullYear(), mes: agora.getMonth() }); // mes de 0 a 11

/**
 * Liga a fatura do cartão escolhido (HTML em CartaoCompras.html): cabeçalho com o logo, o nome e o selo ("Fatura atual", "Fatura anterior" ou
 * "Próxima fatura"), setas para trocar de mês, a fatura total e quatro quadros (compras à vista, parcelas do mês, fechamento e vencimento). A barra e a
 * lista dos lançamentos do cartão não são desta peça: são as da tela de Transações, ligadas pela InvestmentsPage. No mês atual os totais são os da
 * fatura calculada pelo Backend; nos outros meses são somados dos lançamentos (uma compra parcelada conta a parcela, não o total, e uma receita no
 * cartão, um estorno, abate). Todo texto entra com textContent (vem da API). `signal` desliga a busca quando a tela sai.
 * `aoMudarMes()` avisa que o usuário trocou de mês (a lista de lançamentos precisa buscar o novo período).
 * Devolve { mostrar(cartao), esconder(), periodo() } (cartao = um item de GET /investments/cards); `periodo()` dá { dataInicio, dataFim } do mês da
 * fatura. Escolher outro cartão volta ao mês atual.
 */
export function iniciarCompras(raiz, { signal, aoMudarMes } = {}) {
  const area = raiz.querySelector('#invest-compras-area');
  const titulo = raiz.querySelector('#invest-compras-titulo');
  const logo = raiz.querySelector('#invest-fatura-logo');
  const selo = raiz.querySelector('#invest-fatura-selo');
  const rotuloMes = raiz.querySelector('#invest-fatura-mes');
  const total = raiz.querySelector('#invest-fatura-total');
  const quadroAvista = raiz.querySelector('#invest-fatura-avista');
  const quadroParcelas = raiz.querySelector('#invest-fatura-parcelas');
  const quadroFechamento = raiz.querySelector('#invest-fatura-fechamento');
  const quadroVencimento = raiz.querySelector('#invest-fatura-vencimento');

  let cartaoAtual = null;
  let periodo = mesAtualDe();
  let sequencia = 0; // uma resposta de outro cartão ou mês que ainda esteja a caminho deixa de valer
  signal?.addEventListener('abort', () => { sequencia += 1; });

  const ehMesAtual = () => {
    const agora = mesAtualDe();
    return periodo.ano === agora.ano && periodo.mes === agora.mes;
  };

  /** O cabeçalho e os quadros que não dependem das compras: mês, selo, fechamento e vencimento. */
  function desenharCabecalho() {
    const primeiroDia = new Date(Date.UTC(periodo.ano, periodo.mes, 1));
    const nomeDoMes = MES_EM_TEXTO.format(primeiroDia);
    rotuloMes.textContent = nomeDoMes;

    const agora = mesAtualDe();
    const diferenca = (periodo.ano - agora.ano) * 12 + (periodo.mes - agora.mes);
    selo.textContent = diferenca === 0 ? 'Fatura atual' : diferenca < 0 ? 'Fatura anterior' : 'Próxima fatura';
    selo.dataset.situacao = diferenca === 0 ? 'atual' : 'outra';

    const fechamento = new Date(Date.UTC(periodo.ano, periodo.mes, cartaoAtual.diaFechamento));
    const vencimento = new Date(fechamento.getTime() + DIAS_DO_FECHAMENTO_AO_VENCIMENTO * 86_400_000);
    quadroFechamento.textContent = DATA_CURTA.format(fechamento);
    quadroVencimento.textContent = DATA_CURTA.format(vencimento);
  }

  /** Os totais: no mês atual, os da fatura do Backend; nos outros, somados das compras do mês. */
  function desenharTotais(itens) {
    let avista;
    let parcelas;
    if (ehMesAtual()) {
      avista = cartaoAtual.fatura.comprasNoCredito;
      parcelas = cartaoAtual.fatura.parcelasDoMes;
    } else {
      const sinal = (t) => (t.tipo === 'receita' ? -1 : 1); // a receita no cartão (estorno) abate
      avista = itens.filter((t) => !(t.parcelas > 1)).reduce((soma, t) => soma + sinal(t) * t.valor, 0);
      parcelas = itens.filter((t) => t.parcelas > 1).reduce((soma, t) => soma + t.valor / t.parcelas, 0);
    }
    quadroAvista.textContent = formatarMoeda(avista);
    quadroParcelas.textContent = formatarMoeda(parcelas);
    total.textContent = formatarMoeda(ehMesAtual() ? cartaoAtual.fatura.valor : avista + parcelas);
  }

  const intervalo = () => {
    const ultimoDia = new Date(Date.UTC(periodo.ano, periodo.mes + 1, 0)).getUTCDate();
    const base = `${periodo.ano}-${doisDigitos(periodo.mes + 1)}`;
    return { dataInicio: `${base}-01`, dataFim: `${base}-${doisDigitos(ultimoDia)}` };
  };

  /** Desenha o cabeçalho e os totais do mês (no mês atual, os da fatura do Backend; nos outros, somados dos lançamentos do mês). */
  async function buscar() {
    const minha = ++sequencia;
    desenharCabecalho();
    if (ehMesAtual()) {
      desenharTotais([]);
      return;
    }
    try {
      const resposta = await listarTransacoes({ cartaoId: cartaoAtual.id, ...intervalo(), limite: POR_VEZ });
      if (minha !== sequencia) return;
      desenharTotais(resposta.itens);
    } catch {
      if (minha !== sequencia) return;
      for (const quadro of [quadroAvista, quadroParcelas, total]) quadro.textContent = '—';
    }
  }

  function mudarMes(passo) {
    const data = new Date(periodo.ano, periodo.mes + passo, 1);
    periodo = { ano: data.getFullYear(), mes: data.getMonth() };
    buscar();
    aoMudarMes?.();
  }

  raiz.querySelector('#invest-fatura-anterior').addEventListener('click', () => mudarMes(-1), { signal });
  raiz.querySelector('#invest-fatura-seguinte').addEventListener('click', () => mudarMes(1), { signal });

  return {
    /** Mostra a fatura do cartão (e busca de novo na API). Outro cartão volta ao mês atual; o mesmo cartão (depois de uma ação) mantém o mês. */
    mostrar(cartao) {
      if (cartaoAtual?.id !== cartao.id) periodo = mesAtualDe();
      cartaoAtual = cartao;
      titulo.textContent = cartao.nome;
      raiz.querySelector('#invest-fatura-tag-of').hidden = !cartao.openFinance;
      aplicarLogo(logo, cartao);
      area.hidden = false;
      return buscar();
    },

    periodo: intervalo,

    esconder() {
      cartaoAtual = null;
      sequencia += 1;
      area.hidden = true;
    },
  };
}
