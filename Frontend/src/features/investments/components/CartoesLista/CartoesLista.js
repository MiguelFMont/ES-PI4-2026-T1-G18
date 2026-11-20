import { formatarData, formatarMoeda } from '../../../../shared/utils/moeda.js';
import { MAX_CARTOES } from '../../utils/constants.js';

const MES_EM_TEXTO = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Liga a lista de cartões (HTML em CartoesLista.html): um card grande para cada cartão, com a fatura do mês, o vencimento,
 * o limite (e a barra de uso) e os totais, mais o card de adicionar outro (desligado no limite de 5 cartões). A tela
 * decide o que fazer em cada ação: `selecionar(cartao)`, `editar(cartao)`, `excluir(cartao)` e `novo()`. Clicar em qualquer
 * lugar do card (ou no botão Ver compras, para o teclado) o seleciona. Todo texto entra com textContent (vem da API).
 * Devolve { mostrar(cartoes, idSelecionado) }, com a lista de GET /investments/cards.
 */
export function iniciarCartoes(raiz, { signal, selecionar, editar, excluir, novo }) {
  const lista = raiz.querySelector('#invest-cartoes-lista');
  const faixa = raiz.querySelector('#invest-cartoes-faixa');
  const areaNovo = raiz.querySelector('#invest-cartao-novo-area');
  const modelo = raiz.querySelector('#modelo-cartao');
  const modeloNovo = raiz.querySelector('#modelo-cartao-novo');

  const cartoesPorId = new Map();

  // Um só ouvinte para os botões de todos os cards (delegação): eles são recriados a cada carga.
  faixa.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button');
    if (botao?.disabled) return;
    if (botao?.id === 'invest-cartao-novo') {
      novo();
      return;
    }
    const cartao = cartoesPorId.get(evento.target.closest('li[data-id]')?.dataset.id);
    if (!cartao) return;
    // um botão de ação faz a ação dele; qualquer outro ponto do card (ou o Ver compras) seleciona o cartão
    if (botao?.dataset.acao === 'editar') editar(cartao);
    else if (botao?.dataset.acao === 'excluir') excluir(cartao);
    else selecionar(cartao);
  }, { signal });

  const campo = (card, nome) => card.querySelector(`[data-campo="${nome}"]`);

  function criarCard(cartao, idSelecionado) {
    const card = modelo.content.firstElementChild.cloneNode(true);
    card.dataset.id = cartao.id;
    const selecionado = cartao.id === idSelecionado;
    card.classList.toggle('investments-cartao-card--selecionado', selecionado);
    const botaoVer = card.querySelector('[data-acao="selecionar"]');
    botaoVer.setAttribute('aria-pressed', String(selecionado));
    botaoVer.setAttribute('aria-label', `Ver as compras do cartão ${cartao.nome}`);
    const { fatura } = cartao;

    campo(card, 'nome').textContent = cartao.nome;
    campo(card, 'padrao').hidden = !cartao.padrao;
    card.querySelector('[data-acao="editar"]').setAttribute('aria-label', `Editar o cartão ${cartao.nome}`);
    card.querySelector('[data-acao="excluir"]').setAttribute('aria-label', `Excluir o cartão ${cartao.nome}`);

    campo(card, 'mes').textContent = MES_EM_TEXTO.format(new Date(`${fatura.mes}-01T00:00:00Z`));
    campo(card, 'faturaValor').textContent = formatarMoeda(fatura.valor);
    const quando = fatura.diasParaVencer === 0 ? 'vence hoje' : `em ${fatura.diasParaVencer} ${fatura.diasParaVencer === 1 ? 'dia' : 'dias'}`;
    campo(card, 'vencimento').textContent = `Vencimento em ${formatarData(`${fatura.vencimento}T00:00:00Z`)} (${quando})`;

    campo(card, 'limiteDisponivel').textContent = formatarMoeda(cartao.limiteDisponivel);
    campo(card, 'limiteTotal').textContent = formatarMoeda(cartao.limite);

    // a barra mostra quanto do limite está em uso: compras do mês e o saldo devedor dos parcelamentos
    const usado = cartao.limite - cartao.limiteDisponivel;
    const percentual = Math.min(100, Math.max(0, (usado / cartao.limite) * 100));
    const barra = campo(card, 'barra');
    barra.setAttribute('aria-valuenow', String(Math.round(percentual)));
    barra.style.setProperty('--uso', `${percentual}%`);
    barra.classList.toggle('investments-barra--alerta', percentual >= 80);

    const excedido = cartao.limiteDisponivel < 0;
    const aviso = campo(card, 'aviso');
    aviso.hidden = !excedido;
    aviso.textContent = excedido ? `Limite excedido em ${formatarMoeda(-cartao.limiteDisponivel)}.` : '';

    campo(card, 'compras').textContent = formatarMoeda(fatura.comprasNoCredito);
    campo(card, 'parcelas').textContent = formatarMoeda(fatura.parcelasDoMes);
    campo(card, 'saldoDevedor').textContent = formatarMoeda(cartao.saldoDevedor);
    return card;
  }

  return {
    mostrar(cartoes, idSelecionado) {
      cartoesPorId.clear();
      for (const cartao of cartoes) cartoesPorId.set(cartao.id, cartao);

      const cardNovo = modeloNovo.content.firstElementChild.cloneNode(true);
      const botaoNovo = cardNovo.querySelector('button');
      const cheio = cartoes.length >= MAX_CARTOES;
      botaoNovo.disabled = cheio;
      if (cheio) botaoNovo.title = `Você chegou ao limite de ${MAX_CARTOES} cartões.`;

      lista.replaceChildren(...cartoes.map((c) => criarCard(c, idSelecionado)));
      areaNovo.replaceChildren(cardNovo);
    },
  };
}
