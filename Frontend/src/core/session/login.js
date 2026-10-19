// Para onde vai quem está sem sessão: o login é uma rota do index.html, servido pelo Backend na raiz (/).
export const URL_LOGIN = '/#login';

/** Leva à tela de login. `substituir` troca a página atual no histórico (sem deixar "voltar" para ela). */
export function irParaLogin({ substituir = false } = {}) {
  const jaNoLogin = window.location.pathname === '/' && window.location.hash === '#login';
  if (jaNoLogin) return;
  window.location[substituir ? 'replace' : 'assign'](URL_LOGIN);
}
