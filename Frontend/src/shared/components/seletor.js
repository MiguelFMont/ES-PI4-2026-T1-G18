import { entradaPorTeclado } from '../utils/entrada.js';

const ESPERA_PARA_ABRIR_MS = 120; // evita a lista piscar quando o mouse só passa pelo campo
const ESPERA_PARA_FECHAR_MS = 250; // tolera o vão entre o campo e a lista

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

  for (const campo of cadaCampo) ligarSeletor(campo, modelo);

  // clicar fora de qualquer campo fecha as listas (o caminho do evento evita erro se a opção clicada foi recriada)
  document.addEventListener('click', (evento) => {
    for (const campo of cadaCampo) {
      if (!evento.composedPath().includes(campo)) campo.dispatchEvent(new CustomEvent('seletor:fechar'));
    }
  }, { signal }); // `signal` tira este ouvinte do document quando a tela é desmontada
}

function ligarSeletor(campo, modelo) {
  const select = campo.querySelector('select');
  const lista = campo.querySelector('.seletor__lista');
  let temporizador;

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
    lista.replaceChildren(...itens);
  }

  function abrir() {
    clearTimeout(temporizador);
    if (aberta()) return;
    desenhar();
    lista.classList.add('seletor__lista--aberta');
    select.setAttribute('aria-expanded', 'true');
  }

  function fechar() {
    clearTimeout(temporizador);
    if (!aberta()) return;
    lista.classList.remove('seletor__lista--aberta');
    select.setAttribute('aria-expanded', 'false');
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
}
