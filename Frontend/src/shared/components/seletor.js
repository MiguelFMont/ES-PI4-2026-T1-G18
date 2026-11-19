import { entradaPorTeclado } from '../utils/entrada.js';

const ESPERA_PARA_ABRIR_MS = 120; // evita a lista piscar quando o mouse só passa pelo campo
const ESPERA_PARA_FECHAR_MS = 250; // tolera o vão entre o campo e a lista
const DURACAO_FADE_MS = 220; // um pouco mais que a transição de 0,2 s da lista no CSS
const MARGEM_PX = 12; // folga entre a lista e a borda da janela
const ALTURA_MINIMA_PX = 120; // a lista nunca fica menor que isso

/**
 * Liga as listas dos selects dos campos com a classe `campo--seletor` dentro de `raiz` (o HTML de cada campo está em
 * quem o usa, ex.: TransactionFilters.html). Precisa do <template id="modelo-opcao-seletor"> dentro de `raiz`.
 * O <select> continua sendo quem guarda o valor e dispara `change`; a lista abaixo dele é só a forma de escolher:
 *
 * - abre ao passar o mouse sobre o campo e quando o campo é selecionado por Tab (clicar no campo não o mantém aberto);
 * - fecha ao tirar o mouse (se o foco não tiver chegado por Tab), ao sair do campo com Tab, com Esc ou ao clicar fora;
 * - clicar numa opção a escolhe; com o campo selecionado por Tab, as setas (e Home/End) trocam a opção e a lista
 *   acompanha. Enter ou Espaço abrem ou fecham a lista, e Esc fecha.
 *
 * O clique direto no <select> não abre a lista nativa do navegador (pointer-events: none no CSS) e as teclas Enter,
 * Espaço e as setas são tratadas aqui, para não aparecerem duas listas.
 */
export function ligarSeletores(raiz, signal) {
  const modelo = raiz.querySelector('#modelo-opcao-seletor');
  const cadaCampo = raiz.querySelectorAll('.campo--seletor');

  for (const campo of cadaCampo) ligarSeletor(campo, modelo, signal);

  // clicar fora de qualquer campo fecha as listas (o caminho do evento evita erro se a opção clicada foi recriada)
  document.addEventListener('click', (evento) => {
    for (const campo of cadaCampo) {
      if (!evento.composedPath().includes(campo)) campo.dispatchEvent(new CustomEvent('seletor:fechar'));
    }
  }, { signal }); // `signal` tira este ouvinte do document quando a tela é desmontada
}

function ligarSeletor(campo, modelo, signal) {
  const select = campo.querySelector('select');
  const lista = campo.querySelector('.seletor__lista');
  let temporizador;
  let limpeza;

  const aberta = () => lista.classList.contains('seletor__lista--aberta');
  const focoPorTeclado = () => document.activeElement === select && entradaPorTeclado();

  function desenhar() {
    const itens = [...select.options].map((opcao) => {
      const item = modelo.content.firstElementChild.cloneNode(true);
      item.textContent = opcao.textContent;
      item.dataset.valor = opcao.value;
      item.setAttribute('aria-selected', String(opcao.selected));
      if (opcao.selected) item.classList.add('seletor__opcao--escolhida');
      return item;
    });
    const rolagem = lista.scrollTop;
    lista.replaceChildren(...itens);
    lista.scrollTop = rolagem; // trocar as opções zera a rolagem: devolve e garante a escolhida à vista
    lista.querySelector('.seletor__opcao--escolhida')?.scrollIntoView({ block: 'nearest' });
  }

  function abrir() {
    clearTimeout(temporizador);
    clearTimeout(limpeza);
    if (aberta()) return;
    limpar();
    desenhar();
    lista.classList.add('seletor__lista--aberta');
    select.setAttribute('aria-expanded', 'true');
    posicionar();
  }

  // Cabe no espaço livre: embaixo do campo, ou em cima se faltar espaço embaixo e sobrar em cima. Sempre recalcula do
  // zero (altura padrão primeiro), então volta ao tamanho normal quando a página rola para uma região com espaço.
  function posicionar() {
    const rolagem = lista.scrollTop;
    lista.style.removeProperty('--altura-lista');
    lista.classList.remove('seletor__lista--acima');
    const caixa = campo.getBoundingClientRect();
    const natural = lista.scrollHeight; // altura que a lista teria sem limite
    const abaixo = window.innerHeight - caixa.bottom - MARGEM_PX;
    const acima = caixa.top - MARGEM_PX;
    const subir = natural > abaixo && acima > abaixo;
    const espaco = Math.max(subir ? acima : abaixo, ALTURA_MINIMA_PX);
    lista.classList.toggle('seletor__lista--acima', subir);
    if (natural > espaco) lista.style.setProperty('--altura-lista', `${Math.floor(espaco)}px`);
    lista.scrollTop = rolagem; // refazer a altura não pode perder a posição rolada
  }

  function limpar() {
    lista.style.removeProperty('--altura-lista');
    lista.classList.remove('seletor__lista--acima');
  }

  function fechar() {
    clearTimeout(temporizador);
    if (!aberta()) return;
    lista.classList.remove('seletor__lista--aberta');
    select.setAttribute('aria-expanded', 'false');
    // altura e sentido só voltam ao padrão depois do desaparecimento, para a lista não pular durante o fade-out
    limpeza = setTimeout(limpar, DURACAO_FADE_MS);
  }

  function mover(tecla) {
    const ultimo = select.options.length - 1;
    const atual = select.selectedIndex;
    const novo = tecla === 'Home' ? 0 : tecla === 'End' ? ultimo : Math.min(ultimo, Math.max(0, atual + (tecla === 'ArrowDown' ? 1 : -1)));
    if (novo === atual) return;
    select.selectedIndex = novo;
    select.dispatchEvent(new Event('change', { bubbles: true })); // aplica o filtro e a lista marca a nova opção
  }

  function escolher(valor) {
    if (select.value !== valor) {
      select.value = valor;
      select.dispatchEvent(new Event('change', { bubbles: true })); // quem usa o campo reage a este evento
    }
    fechar();
  }

  // Mouse: abre depois de uma pequena espera e fecha ao sair, a menos que o campo esteja selecionado por Tab.
  campo.addEventListener('mouseenter', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(abrir, ESPERA_PARA_ABRIR_MS);
  });
  campo.addEventListener('mouseleave', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (!focoPorTeclado()) fechar();
    }, ESPERA_PARA_FECHAR_MS);
  });

  // Teclado: chegar com Tab abre; sair fecha. (Um foco vindo de clique não abre: quem abre é o mouse sobre o campo.)
  select.addEventListener('focus', () => {
    if (entradaPorTeclado()) abrir();
  });
  select.addEventListener('blur', fechar);
  select.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      fechar();
    } else if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault(); // não abre a lista nativa
      if (aberta()) fechar();
      else abrir();
    } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp' || evento.key === 'Home' || evento.key === 'End') {
      // As setas trocam a opção aqui mesmo: no select personalizável elas abririam a lista nativa e o foco sairia.
      evento.preventDefault();
      mover(evento.key);
    }
  });
  select.addEventListener('change', () => {
    if (aberta()) desenhar(); // as setas trocaram a opção: a lista marca a nova
  });

  // Escolher com o mouse. O mousedown não tira o foco do select.
  lista.addEventListener('mousedown', (evento) => evento.preventDefault());
  lista.addEventListener('click', (evento) => {
    const opcao = evento.target.closest('.seletor__opcao');
    if (opcao) escolher(opcao.dataset.valor);
  });

  campo.addEventListener('seletor:fechar', fechar);

  // Rolar a página ou mudar a janela muda o espaço livre: recalcula posição e altura (inclusive voltando ao normal).
  const reposicionar = (evento) => {
    if (evento?.target instanceof Node && lista.contains(evento.target)) return; // rolar a própria lista não reposiciona
    if (aberta()) posicionar();
  };
  window.addEventListener('scroll', reposicionar, { capture: true, passive: true, signal });
  window.addEventListener('resize', reposicionar, { signal });
}
