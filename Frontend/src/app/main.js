import { hasToken } from '../core/session/storage.js';
import { iniciarTema } from '../core/theme/theme.js';
import { ligarMenu } from '../core/layout/menu.js';
import { URL_LOGIN } from '../core/session/login.js';

const appContent = document.querySelector('#app-content');

// Telas feitas em arquivos (modelo SPA): o roteador busca o HTML, carrega os CSS e o módulo da tela, escreve o HTML
// em #app-content e chama montar(container); ao sair, chama desmontar() e tira os CSS. Quem criar uma tela
// nova acrescenta uma entrada aqui (o link do menu no index.html usa o mesmo nome em data-rota).
const TELAS = {
  transactions: {
    titulo: 'Transações',
    html: '/src/features/transactions/views/transactions.html',
    css: [
      '/src/shared/styles/campos.css',
      '/src/shared/styles/calendario.css',
      '/src/features/transactions/styles/transactions.css',
      '/src/features/transactions/components/TransactionResumo/TransactionResumo.css',
      '/src/features/transactions/components/TransactionFilters/TransactionFilters.css',
      '/src/features/transactions/components/TransactionExtrato/TransactionExtrato.css',
      '/src/features/transactions/components/TransactionForm/TransactionForm.css',
    ],
    modulo: () => import('../features/transactions/index.js'),
  },
};

let telaAtual = null; // { modulo, links } da tela montada agora
let sequencia = 0; // descarta uma montagem que ficou para trás se o usuário já foi para outra rota

iniciarTema();

ligarMenu();

// O menu está escrito no index.html; aqui só se mostra (com sessão) e se marca o item da rota atual.
function renderMenu(route) {
  document.body.classList.toggle('com-sessao', hasToken());
  for (const link of document.querySelectorAll('#main-header a[data-rota]')) {
    if (link.dataset.rota === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function currentRoute() {
  return window.location.hash.slice(1).split('?')[0] || 'login';
}

function navigate(route) {
  window.location.hash = `#${route}`;
}

// Coloca um <link> por CSS no <head> e espera todos carregarem (evita a tela aparecer sem estilo).
function carregarCss(enderecos) {
  return Promise.all(
    enderecos.map(
      (href) =>
        new Promise((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.dataset.tela = '';
          link.addEventListener('load', () => resolve(link));
          link.addEventListener('error', () => reject(new Error(`Não foi possível carregar ${href}.`)));
          document.head.append(link);
        })
    )
  );
}

function desmontarTela() {
  if (!telaAtual) return;
  telaAtual.modulo.desmontar?.();
  for (const link of document.querySelectorAll('link[data-tela]')) link.remove();
  telaAtual = null;
}

async function montarTela(tela, minha) {
  const [html, modulo] = await Promise.all([
    fetch(tela.html).then((resposta) => {
      if (!resposta.ok) throw new Error(`Não foi possível carregar ${tela.html} (${resposta.status}).`);
      return resposta.text();
    }),
    tela.modulo(),
    carregarCss(tela.css),
  ]);
  if (minha !== sequencia) return; // o usuário já foi para outra rota; o próximo renderRoute tira os CSS

  appContent.innerHTML = html;
  telaAtual = { modulo };
  await modulo.montar(appContent);
}

async function renderRoute() {
  if (!appContent) return;
  const minha = ++sequencia;
  desmontarTela();
  for (const link of document.querySelectorAll('link[data-tela]')) link.remove(); // sobras de uma montagem interrompida

  let route = currentRoute();
  if (route === 'login' && hasToken()) {
    navigate('dashboard');
    route = 'dashboard';
  } else if (route === 'login' || !hasToken()) {
    window.location.replace(URL_LOGIN); // o login é uma página independente (feature auth), fora do roteador
    return;
  }

  document.title = TELAS[route] ? `${TELAS[route].titulo} | FinanceAI` : 'FinanceAI';
  window.scrollTo(0, 0);

  if (TELAS[route]) {
    try {
      await montarTela(TELAS[route], minha);
    } catch (erro) {
      if (minha === sequencia) appContent.textContent = erro.message;
    }
    if (minha === sequencia) renderMenu(route);
    return;
  }

  switch (route) {
    case 'dashboard':
      appContent.innerHTML = `
        <section aria-labelledby="dashboard-title">
          <h1 id="dashboard-title">Dashboard</h1>
          <p>Bem-vindo ao seu painel financeiro.</p>
        </section>`;
      break;
    default:
      appContent.innerHTML = `
        <section aria-labelledby="not-found-title">
          <h1 id="not-found-title">Página não encontrada</h1>
          <a href="#login">Voltar para o início</a>
        </section>`;
  }

  renderMenu(route);
}

window.addEventListener('hashchange', renderRoute);
renderRoute();
