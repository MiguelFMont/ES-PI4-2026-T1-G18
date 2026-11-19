import { formatarMoeda } from '../../../../shared/utils/moeda.js';
import { MAX_CARTOES } from '../../utils/constants.js';

/**
 * Liga o seletor de cartões (HTML em CartoesSeletor.html): um botão por cartão, com o nome e a fatura do mês, e o botão de
 * adicionar outro (desligado no limite de 5 cartões). A tela decide o que fazer (`selecionar(id)` ao escolher um
 * cartão e `novo()` ao pedir um cartão novo). Todo texto entra com textContent (vem da API).
 * Devolve { mostrar(cartoes, idSelecionado) }, com a lista de GET /investments/cards.
 */
export function iniciarCartoes(raiz, { signal, selecionar, novo }) {
  const lista = raiz.querySelector('#invest-cartoes-lista');
  const modelo = raiz.querySelector('#modelo-chip-cartao');
  const botaoNovo = raiz.querySelector('#invest-cartao-novo');

  // Um só ouvinte para todos os botões (delegação): eles são recriados a cada carga.
  lista.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-id]');
    if (botao) selecionar(botao.dataset.id);
  }, { signal });
  botaoNovo.addEventListener('click', () => novo(), { signal });

  function criarBotao(cartao, idSelecionado) {
    const botao = modelo.content.firstElementChild.cloneNode(true);
    botao.dataset.id = cartao.id;
    botao.setAttribute('aria-pressed', String(cartao.id === idSelecionado));
    botao.querySelector('[data-campo="nome"]').textContent = cartao.nome;
    botao.querySelector('[data-campo="fatura"]').textContent = `Fatura ${formatarMoeda(cartao.fatura.valor)}`;
    return botao;
  }

  return {
    mostrar(cartoes, idSelecionado) {
      lista.replaceChildren(...cartoes.map((cartao) => criarBotao(cartao, idSelecionado)));
      const cheio = cartoes.length >= MAX_CARTOES;
      botaoNovo.disabled = cheio;
      botaoNovo.title = cheio ? `Você chegou ao limite de ${MAX_CARTOES} cartões.` : '';
    },
  };
}
