// Tema claro/escuro. O escolhido fica em localStorage; sem escolha, vale o tema escuro (padrão do protótipo).
const CHAVE = '@FinanceAI:tema';
// Estilo da interface: 'sombras' (padrão, cartões e campos destacados por sombras) ou 'bordas' (linhas finas no lugar
// das sombras). Fica em localStorage e vira o atributo data-estilo no <html>; as variáveis do estilo 'bordas' estão
// em core/styles/global.css (bloco :root[data-estilo='bordas']).
const CHAVE_ESTILO = '@FinanceAI:estilo';

// Paleta de cores (a cor de destaque da interface): a escolhida vira o atributo data-paleta no <html>; as cores de cada
// paleta estão em core/styles/global.css (blocos :root[data-paleta=...]). "padrao" é o verde-limão do tema escuro e o verde-floresta do claro.
const CHAVE_PALETA = '@FinanceAI:paleta';
// as cores mostradas nas amostras de Minha conta > Preferências: [cartão, destaque, apoio, destaque no tema claro]
export const PALETAS = [
  { valor: 'padrao', nome: 'Padrão', descricao: 'Neutra, com verde-limão no escuro', amostra: ['#0b0c10', '#c6f432', '#f1f3f2', '#1e6b47'] },
  { valor: 'esmeralda', nome: 'Esmeralda e âmbar', descricao: 'Verde com um toque de dourado', amostra: ['#161a1e', '#34d399', '#fbbf24', '#047857'] },
  { valor: 'oceano', nome: 'Oceano e coral', descricao: 'Azul-céu com rosa-coral', amostra: ['#151b23', '#38bdf8', '#fb7185', '#0369a1'] },
  { valor: 'violeta', nome: 'Violeta e lima', descricao: 'Roxo com verde-limão', amostra: ['#18171e', '#a78bfa', '#bef264', '#6d28d9'] },
  { valor: 'terra', nome: 'Terra e turquesa', descricao: 'Laranja queimado com turquesa', amostra: ['#1c1a17', '#fb923c', '#2dd4bf', '#c2410c'] },
];

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

function lerEstiloSalvo() {
  try {
    return localStorage.getItem(CHAVE_ESTILO);
  } catch {
    return null; // armazenamento bloqueado: segue sem persistir
  }
}

export function estiloAtual() {
  return document.documentElement.dataset.estilo === 'bordas' ? 'bordas' : 'sombras';
}

export function aplicarEstilo(estilo) {
  const valido = estilo === 'bordas' ? 'bordas' : 'sombras';
  document.documentElement.dataset.estilo = valido;
  try {
    localStorage.setItem(CHAVE_ESTILO, valido);
  } catch {
    // sem persistência, o estilo vale só nesta sessão da página
  }
}

function lerPaletaSalva() {
  try {
    return localStorage.getItem(CHAVE_PALETA);
  } catch {
    return null;
  }
}

const paletaValida = (valor) => (PALETAS.some((p) => p.valor === valor) ? valor : 'padrao');

export function paletaAtual() {
  return paletaValida(document.documentElement.dataset.paleta);
}

export function aplicarPaleta(paleta) {
  const valida = paletaValida(paleta);
  const aplicar = () => { document.documentElement.dataset.paleta = valida; };
  if (reduzirMovimento()) aplicar();
  else trocarComFade(aplicar); // as cores passam suavemente de uma paleta à outra
  try {
    localStorage.setItem(CHAVE_PALETA, valida);
  } catch {
    // sem persistência, a paleta vale só nesta sessão da página
  }
  return valida;
}

// Aplica o tema e o estilo guardados. Roda antes de a tela ser montada, então não há piscada de outro visual.
export function iniciarTema() {
  document.documentElement.dataset.tema = lerSalvo() === 'claro' ? 'claro' : 'escuro';
  document.documentElement.dataset.estilo = lerEstiloSalvo() === 'bordas' ? 'bordas' : 'sombras';
  document.documentElement.dataset.paleta = paletaValida(lerPaletaSalva());
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

/**
 * Alterna o estilo da interface entre 'sombras' e 'bordas' e devolve o novo. As sombras e bordas passam
 * suavemente de um estilo ao outro (o mesmo fade do tema); com "reduzir movimento" ativado, a troca é instantânea.
 */
export function alternarEstilo() {
  const novo = estiloAtual() === 'bordas' ? 'sombras' : 'bordas';
  if (reduzirMovimento()) aplicarEstilo(novo);
  else trocarComFade(() => aplicarEstilo(novo));
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
