import { hasToken, clearSession } from '../core/session/storage.js';

const PUBLIC_ROUTES = new Set(['login']);
const appContent = document.querySelector('#app-content');

function currentRoute() {
  return window.location.hash.slice(1).split('?')[0] || 'login';
}

function navigate(route) {
  window.location.hash = `#${route}`;
}

function renderRoute() {
  if (!appContent) return;

  let route = currentRoute();
  if (!PUBLIC_ROUTES.has(route) && !hasToken()) {
    navigate('login');
    route = 'login';
  } else if (route === 'login' && hasToken()) {
    navigate('dashboard');
    route = 'dashboard';
  }

  switch (route) {
    case 'login':
      appContent.innerHTML = `
        <section aria-labelledby="login-title">
          <h1 id="login-title">Entrar no FinanceAI</h1>
          <p>A tela de autenticação será fornecida pela feature auth.</p>
        </section>`;
      break;
    case 'dashboard':
      appContent.innerHTML = `
        <section aria-labelledby="dashboard-title">
          <h1 id="dashboard-title">Dashboard</h1>
          <p>Bem-vindo ao seu painel financeiro.</p>
          <button type="button" id="logout-button">Sair</button>
        </section>`;
      appContent.querySelector('#logout-button')?.addEventListener('click', () => {
        clearSession();
        navigate('login');
      });
      break;
    default:
      appContent.innerHTML = `
        <section aria-labelledby="not-found-title">
          <h1 id="not-found-title">Página não encontrada</h1>
          <a href="#login">Voltar para o início</a>
        </section>`;
  }
}

window.addEventListener('hashchange', renderRoute);
renderRoute();
