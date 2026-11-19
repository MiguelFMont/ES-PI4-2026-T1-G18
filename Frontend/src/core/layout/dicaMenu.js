// src/core/layout/dicaMenu.js
// Dica animada do menu lateral RECOLHIDO. Com o menu aberto o nome de cada item já aparece ao lado do ícone; recolhido,
// sobram só os ícones, e este rótulo nasce do ícone (mouse ou Tab) e se expande para a direita. É um único elemento
// (#dica-menu, no index.html) com position: fixed, porque o #main-header tem overflow: hidden e cortaria uma dica filha.
// O nome vem do <span class="menu-texto"> do item (que menu.js e valores.js mantêm atualizado) ou, no botão de
// recolher, do aria-label. Os itens não têm atributo title, para o navegador não mostrar a dica preta padrão.

const SELETOR_ITENS = '#main-header a, #main-header button';
const AFASTAMENTO = 8; // px entre o ícone e a dica
const CELULAR = '(max-width: 767px)'; // no celular o menu nunca fica recolhido

function nomeDoItem(item) {
  const texto = item.querySelector('.menu-texto');
  return (texto ? texto.textContent : item.getAttribute('aria-label') || '').trim();
}

export function ligarDicaMenu() {
  const dica = document.querySelector('#dica-menu');
  const cabecalho = document.querySelector('#main-header');
  if (!dica || !cabecalho || dica.dataset.ligada) return;
  dica.dataset.ligada = 'true';
  const texto = dica.querySelector('.dica-menu__texto');
  const celular = window.matchMedia(CELULAR);
  let itemAtual = null;

  function podeMostrar() {
    return document.body.classList.contains('menu-recolhido')
      && document.body.classList.contains('com-sessao')
      && !celular.matches;
  }

  /** Põe a dica ao lado do item. As variáveis dizem de onde a animação parte: o tamanho e a posição do ícone. */
  function posicionar(item) {
    const caixa = item.getBoundingClientRect();
    texto.textContent = nomeDoItem(item);
    dica.style.top = caixa.top + 'px';
    dica.style.left = caixa.right + AFASTAMENTO + 'px';
    dica.style.height = caixa.height + 'px';
    const largura = dica.offsetWidth || 1;
    dica.style.setProperty('--dica-recuo', caixa.width + AFASTAMENTO + 'px');
    dica.style.setProperty('--dica-escala', String(Math.min(1, caixa.width / largura)));
  }

  function mostrar(item) {
    if (!podeMostrar() || !nomeDoItem(item)) return;
    const jaVisivel = dica.classList.contains('dica-menu--visivel');
    itemAtual = item;
    posicionar(item);
    if (!jaVisivel) dica.getBoundingClientRect(); // fixa o estado de partida (no ícone) antes de ligar a animação
    dica.classList.add('dica-menu--visivel');
  }

  function esconder() {
    itemAtual = null;
    dica.classList.remove('dica-menu--visivel');
  }

  /** Sai do mouse mas o teclado ainda está num item: a dica passa para ele. */
  function voltarParaFoco() {
    const foco = document.activeElement;
    if (foco && foco.matches && foco.matches(SELETOR_ITENS) && foco.matches(':focus-visible')) mostrar(foco);
    else esconder();
  }

  for (const item of cabecalho.querySelectorAll(SELETOR_ITENS)) {
    item.addEventListener('pointerenter', (evento) => {
      if (evento.pointerType !== 'touch') mostrar(item);
    });
    item.addEventListener('pointerleave', () => {
      if (itemAtual === item) voltarParaFoco();
    });
    item.addEventListener('focus', () => {
      if (item.matches(':focus-visible')) mostrar(item);
    });
    item.addEventListener('blur', () => {
      if (itemAtual === item) esconder();
    });
  }

  // "Sair" leva ao login (o menu some); o clique já esconde a dica antes disso.
  cabecalho.querySelector('#botao-sair')?.addEventListener('click', esconder);

  // O nome de Tema e de Ocultar valores muda no clique: a dica acompanha enquanto está aberta.
  new MutationObserver(() => {
    if (itemAtual) posicionar(itemAtual);
  }).observe(cabecalho, { childList: true, characterData: true, subtree: true });

  // Recolher, expandir ou sair da sessão: a dica não fica presa na tela.
  new MutationObserver(() => {
    if (!podeMostrar()) esconder();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // A lista do menu rola quando a janela é baixa: a dica ficaria longe do ícone.
  cabecalho.addEventListener('scroll', esconder, true);
  window.addEventListener('resize', esconder);
  window.addEventListener('blur', esconder);
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') esconder();
  });
}
