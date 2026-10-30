// Para onde vai quem está sem sessão: a página de login (feature auth), independente do index.html.
export const URL_LOGIN = '/src/features/auth/components/inicio.html';

/** Leva à tela de login. `substituir` troca a página atual no histórico (sem deixar "voltar" para ela). */
export function irParaLogin({ substituir = false } = {}) {
  if (window.location.pathname === URL_LOGIN) return;
  window.location[substituir ? 'replace' : 'assign'](URL_LOGIN);
}
