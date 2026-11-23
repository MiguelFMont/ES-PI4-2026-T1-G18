import { formatarMoeda } from '../../../../shared/utils/moeda.js';
import { MAX_CARTOES } from '../../utils/constants.js';
import { aplicarLogo } from '../../utils/logo.js';

/**
 * Liga a fila de cartões (HTML em CartoesLista.html): um card para cada cartão (logo, nome, tipo e conta, fechamento e vencimento, Editar e
 * Excluir, fatura atual e limite disponível) numa fila horizontal com barra de rolagem, mais o card de adicionar outro (desligado no limite
 * de 5 cartões). A tela decide o que fazer em `selecionar(cartao)`, `editar(cartao)`, `excluir(cartao)` e `novo()`. Clicar no card, ou Enter e
 * Espaço nele, escolhe o cartão (e a fatura dele aparece abaixo). Todo texto entra com textContent (vem da API).
 * Devolve { mostrar(cartoes, idSelecionado) }, com a lista de GET /investments/cards.
 */
export function iniciarCartoes(raiz, { signal, selecionar, editar, excluir, novo }) {
  const lista = raiz.querySelector('#invest-cartoes-lista');
  const faixa = raiz.querySelector('#invest-cartoes-faixa');
  const areaNovo = raiz.querySelector('#invest-cartao-novo-area');
  const semCartao = raiz.querySelector('#invest-sem-cartao');
  const modelo = raiz.querySelector('#modelo-cartao');
  const modeloNovo = raiz.querySelector('#modelo-cartao-novo');

  const cartoesPorId = new Map();

  // Um só ouvinte para todos os cards (delegação): eles são recriados a cada carga.
  faixa.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button');
    if (botao?.disabled) return;
    if (botao?.id === 'invest-cartao-novo') {
      novo();
      return;
    }
    const cartao = cartoesPorId.get(evento.target.closest('li[data-id]')?.dataset.id);
    if (!cartao) return;
    // um botão de ação faz a ação dele; qualquer outro ponto do card escolhe o cartão
    if (botao?.dataset.acao === 'editar') editar(cartao);
    else if (botao?.dataset.acao === 'excluir') excluir(cartao);
    else selecionar(cartao);
  }, { signal });

  faixa.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const card = evento.target.closest('li[data-id]');
    if (!card || evento.target !== card) return;
    evento.preventDefault();
    const cartao = cartoesPorId.get(card.dataset.id);
    if (cartao) selecionar(cartao);
  }, { signal });

  const campo = (card, nome) => card.querySelector(`[data-campo="${nome}"]`);

  function criarCard(cartao, idSelecionado) {
    const card = modelo.content.firstElementChild.cloneNode(true);
    card.dataset.id = cartao.id;
    const selecionado = cartao.id === idSelecionado;
    card.classList.toggle('investments-cartao-card--selecionado', selecionado);
    card.setAttribute('aria-pressed', String(selecionado));
    card.setAttribute('aria-label', `Cartão ${cartao.nome}`);

    aplicarLogo(campo(card, 'logo'), cartao);
    campo(card, 'nome').textContent = cartao.nome;
    campo(card, 'tagOpenFinance').hidden = !cartao.openFinance; // a tag: o cartão é de uma conta Open Finance
    const origem = cartao.openFinance ? 'Cartão Open Finance' : 'Cartão manual';
    campo(card, 'tipo').textContent = cartao.conta ? `${origem} · ${cartao.conta.nome}` : `${origem} · sem conta vinculada`;
    campo(card, 'ciclo').textContent = `Fecha dia ${cartao.diaFechamento} · Vence dia ${Number(cartao.fatura.vencimento.slice(8, 10))}`;
    campo(card, 'faturaValor').textContent = formatarMoeda(cartao.fatura.valor);
    campo(card, 'limiteDisponivel').textContent = formatarMoeda(cartao.limiteDisponivel);
    card.querySelector('[data-acao="editar"]').setAttribute('aria-label', `Editar o cartão ${cartao.nome}`);
    // cartão Open Finance: só o ícone e a cor mudam e ele não se exclui (desconectando a conta, ele vira manual)
    const excluir = card.querySelector('[data-acao="excluir"]');
    if (cartao.openFinance) excluir.remove();
    else excluir.setAttribute('aria-label', `Excluir o cartão ${cartao.nome}`);
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
      lista.hidden = cartoes.length === 0;
      faixa.classList.toggle('investments-cartoes-faixa--vazia', cartoes.length === 0); // sem cartão, o botão Novo cartão ocupa a largura toda
      semCartao.hidden = cartoes.length > 0;
      areaNovo.replaceChildren(cardNovo);
    },
  };
}
