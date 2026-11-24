// O marcador do menu lateral: um bloco na cor de destaque que DESLIZA de um item para o outro quando a tela muda (no lugar de o
// fundo "pular"). O item da rota atual continua sendo o que tem aria-current="page" (app/main.js); aqui só se acompanha a posição dele.
// Só a troca de rota anima; recolher o menu, redimensionar ou rolar a lista apenas reposicionam o marcador, sem deslizar.

export function ligarMarcadorMenu() {
  const menu = document.querySelector('#main-header .menu-lateral');
  if (!menu) return { atualizar() {} };

  const marcador = document.createElement('span');
  marcador.className = 'menu-marcador';
  marcador.setAttribute('aria-hidden', 'true');
  menu.prepend(marcador);

  let jaPosicionou = false;

  function posicionar(animar) {
    const ativo = menu.querySelector('a[aria-current="page"]');
    if (!ativo || !ativo.offsetParent) {
      marcador.classList.remove('menu-marcador--visivel');
      jaPosicionou = false;
      return;
    }
    const caixaMenu = menu.getBoundingClientRect();
    const caixa = ativo.getBoundingClientRect();
    // a primeira vez (ou depois de o menu ter ficado escondido) aparece no lugar, sem deslizar de longe
    marcador.classList.toggle('menu-marcador--parado', !(animar && jaPosicionou));
    marcador.style.width = `${caixa.width}px`;
    marcador.style.height = `${caixa.height}px`;
    marcador.style.transform = `translate(${caixa.left - caixaMenu.left}px, ${caixa.top - caixaMenu.top}px)`;
    marcador.classList.add('menu-marcador--visivel');
    jaPosicionou = true;
  }

  // recolher/expandir muda a largura do menu (com animação): o marcador acompanha, sem o atraso do deslize
  new ResizeObserver(() => posicionar(false)).observe(menu);
  menu.querySelector('.main-nav')?.addEventListener('scroll', () => posicionar(false), { passive: true });
  window.addEventListener('resize', () => posicionar(false));
  document.fonts?.ready.then(() => posicionar(false));

  return { atualizar: () => posicionar(true) };
}
