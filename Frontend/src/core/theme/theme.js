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

export function alternarTema() {
  const novo = temaAtual() === 'claro' ? 'escuro' : 'claro';
  aplicarTema(novo);
  return novo;
}
