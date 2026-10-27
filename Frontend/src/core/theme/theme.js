// Tema claro/escuro. O escolhido fica em localStorage; sem escolha, vale o tema escuro (padrão do protótipo).
const CHAVE = '@FinanceAI:tema';

function lerSalvo() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null; // armazenamento bloqueado: segue sem persistir
  }
}

export function temaAtual() {
  return document.documentElement.dataset.tema === 'claro' ? 'claro' : 'escuro';
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // sem persistência, o tema vale só nesta sessão da página
  }
}

export function iniciarTema() {
  document.documentElement.dataset.tema = lerSalvo() === 'claro' ? 'claro' : 'escuro';
}

// Troca de tema com animação. Nos navegadores com a View Transitions API, o tema novo cresce em um círculo a
// partir do botão clicado e cobre o antigo (a animação do círculo é feita aqui; o CSS só desliga o fade padrão,
// em core/styles/global.css). Nos outros, as cores passam suavemente de um tema ao outro: durante a troca o
// <html> recebe a classe `tema-em-transicao`, que liga as transições de cor. Com "reduzir movimento" ativado no
// sistema, a troca é instantânea.
const DURACAO_REVELACAO_MS = 650;
const DURACAO_FADE_MS = 400;
let temporizadorFade;

const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Troca o tema. `origem` é o elemento clicado (de onde o círculo nasce) e `aoAplicar(novoTema)` roda
 * junto com a troca (o botão usa isso para atualizar o próprio texto). Devolve o novo tema.
 */
export function alternarTema({ origem, aoAplicar } = {}) {
  const novo = temaAtual() === 'claro' ? 'escuro' : 'claro';
  const trocar = () => {
    aplicarTema(novo);
    aoAplicar?.(novo);
  };

  if (reduzirMovimento()) {
    trocar();
  } else if (document.startViewTransition) {
    revelarEmCirculo(trocar, origem);
  } else {
    trocarComFade(trocar);
  }
  return novo;
}

function revelarEmCirculo(trocar, origem) {
  const caixa = origem?.getBoundingClientRect();
  const x = caixa ? caixa.left + caixa.width / 2 : window.innerWidth / 2;
  const y = caixa ? caixa.top + caixa.height / 2 : window.innerHeight / 2;
  // raio até o canto mais distante da tela: o círculo termina cobrindo tudo
  const raio = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transicao = document.startViewTransition(trocar);
  transicao.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
        { duration: DURACAO_REVELACAO_MS, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
      );
    })
    .catch(() => {}); // transição cancelada (por exemplo, outra troca no meio): o tema já foi aplicado
}

function trocarComFade(trocar) {
  const raiz = document.documentElement;
  clearTimeout(temporizadorFade);
  raiz.classList.add('tema-em-transicao');
  trocar();
  temporizadorFade = setTimeout(() => raiz.classList.remove('tema-em-transicao'), DURACAO_FADE_MS + 50);
}
