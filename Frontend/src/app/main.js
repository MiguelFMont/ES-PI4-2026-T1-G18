import { hasToken } from '../core/session/storage.js';
import { iniciarTema } from '../core/theme/theme.js';
import { ligarMenu } from '../core/layout/menu.js';
import { ligarMarcadorMenu } from '../core/layout/marcadorMenu.js';
import { ligarDicaMenu } from '../core/layout/dicaMenu.js';
import { URL_LOGIN } from '../core/session/login.js';
import { iniciarOcultacaoValores } from '../core/privacy/valores.js';
import { confirmar } from '../shared/components/notificacao.js';

const appContent = document.querySelector('#app-content');
// Troca de tela: o conteúdo antigo fica escondido (sem mostrar nada no lugar) do começo da troca até a tela nova estar
// montada (HTML, CSS e componentes). Sem isso, o HTML da tela antiga aparecia sem estilo (os CSS dela são removidos na
// hora) e o da nova ia surgindo em pedaços. Depois disso, cada componente mostra o próprio esqueleto cinza enquanto
// espera os dados da API (classe .esqueleto em core/styles/global.css). Se a montagem demorar mais que o limite abaixo,
// o conteúdo aparece mesmo assim.
const TEMPO_MAXIMO_ESCONDIDO_MS = 1500;

function esconderConteudo(esconder) {
  appContent.classList.toggle('tela-trocando', esconder);
}

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
      '/src/features/transactions/components/TransactionBarra/TransactionBarra.css',
      '/src/features/transactions/components/TransactionLista/TransactionLista.css',
      '/src/features/transactions/components/TransactionDetalhe/TransactionDetalhe.css',
      '/src/features/transactions/components/TransactionForm/TransactionForm.css',
      '/src/features/transactions/components/TransactionCartao/TransactionCartao.css',
      '/src/features/goals/styles/goals.css', // o formulário "Nova meta" da janela de vincular a transação a uma meta
    ],
    modulo: () => import('../features/transactions/index.js'),
  },
  'contas-conectadas': {
    titulo: 'Contas conectadas',
    html: '/src/features/contas-conectadas/views/contas-conectadas.html',
    css: [
      '/src/shared/styles/campos.css', // os campos da janela de conta
      '/src/features/contas-conectadas/styles/contas-conectadas.css',
      '/src/features/contas-conectadas/components/ContasMinhas/ContasMinhas.css',
      '/src/features/contas-conectadas/components/ContaForm/ContaForm.css',
      '/src/features/contas-conectadas/components/ContasConectar/ContasConectar.css',
      '/src/features/contas-conectadas/components/ContasLista/ContasLista.css',
    ],
    modulo: () => import('../features/contas-conectadas/index.js'),
  },
  metas: {
    titulo: 'Metas',
    html: '/src/features/goals/views/goals.html',
    css: [
      '/src/shared/styles/campos.css',
      '/src/shared/styles/calendario.css',
      '/src/features/goals/styles/goals.css',
    ],
    modulo: () => import('../features/goals/index.js'),
  },
  cartao: {
    titulo: 'Cartão de crédito',
    html: '/src/features/investments/views/investments.html',
    css: [
      '/src/shared/styles/campos.css',
      '/src/shared/styles/calendario.css',
      '/src/features/investments/styles/investments.css',
      // os lançamentos do cartão usam as peças da tela de Transações
      '/src/features/transactions/styles/transactions.css',
      '/src/features/transactions/components/TransactionBarra/TransactionBarra.css',
      '/src/features/transactions/components/TransactionLista/TransactionLista.css',
      '/src/features/transactions/components/TransactionDetalhe/TransactionDetalhe.css',
      '/src/features/transactions/components/TransactionForm/TransactionForm.css',
      '/src/features/transactions/components/TransactionCartao/TransactionCartao.css',
      '/src/features/goals/styles/goals.css', // o formulário "Nova meta" da janela de vincular a transação a uma meta
    ],
    modulo: () => import('../features/investments/index.js'),
  },
  perfil: {

    titulo: 'Minha conta',
    html: '/src/features/perfil/components/minhaConta.html',
  css: [
      '/src/features/perfil/styles/minhaConta.css',
    ],
  modulo: () => import('../features/Perfil/index.js'),
},
  'mentor-ia': {
    titulo: 'Mentor IA',
    html: '/src/features/mentor-ia/views/mentor-ia.html',
    css: [
      '/src/shared/styles/campos.css',
      '/src/features/mentor-ia/styles/mentor-ia.css',
      '/src/features/mentor-ia/components/MentorAlertas/MentorAlertas.css',
      '/src/features/mentor-ia/components/MentorConversa/MentorConversa.css',
      '/src/features/mentor-ia/components/MentorEntrada/MentorEntrada.css',
    ],
    modulo: () => import('../features/mentor-ia/index.js'),
  },
};

let telaAtual = null; // { modulo } da tela montada agora
let rotaAtual = null; // a rota que está na tela (para voltar a ela se o usuário desistir de sair)
let sequencia = 0; // descarta uma montagem que ficou para trás se o usuário já foi para outra rota

iniciarTema();
ligarMenu();
ligarDicaMenu();
iniciarOcultacaoValores();
const marcadorMenu = ligarMarcadorMenu();

// O menu está escrito no index.html; aqui só se mostra (com sessão) e se marca o item da rota atual.
function renderMenu(route) {
  document.body.classList.toggle('com-sessao', hasToken());
  for (const link of document.querySelectorAll('#main-header a[data-rota]')) {
    if (link.dataset.rota === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  marcadorMenu.atualizar(); // o marcador desliza até o item da rota
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

  // Sair de uma tela com alterações não confirmadas pede confirmação; se o usuário desistir, volta para a rota dela.
  if (telaAtual?.modulo.temPendencias?.() && currentRoute() !== rotaAtual) {
    const sair = await confirmar(
      'Há alterações não confirmadas. Sair e descartá-las?',
      'aviso'
    );
    if (!sair) {
      history.replaceState(null, '', `#${rotaAtual}`); // não dispara hashchange
      return;
    }
  }

  const minha = ++sequencia;
  esconderConteudo(true); // antes de tirar os CSS da tela antiga: os dois acontecem no mesmo quadro, sem pintar entre eles
  setTimeout(() => {
    if (minha === sequencia) esconderConteudo(false); // montagem lenta: mostra o que já tem
  }, TEMPO_MAXIMO_ESCONDIDO_MS);
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

  rotaAtual = route;
  document.title = TELAS[route] ? `${TELAS[route].titulo} | FinanceAI` : 'FinanceAI';
  window.scrollTo(0, 0);

  if (TELAS[route]) {
    try {
      await montarTela(TELAS[route], minha);
    } catch (erro) {
      if (minha === sequencia) appContent.textContent = erro.message;
    }
    if (minha === sequencia) {
      renderMenu(route);
      esconderConteudo(false);
    }
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
  esconderConteudo(false);
}

// Com sessão, o menu e a camada de carregamento já valem na primeira tela (sem token, o roteador vai para o login).
document.body.classList.toggle('com-sessao', hasToken());

window.addEventListener('hashchange', renderRoute);
renderRoute();
