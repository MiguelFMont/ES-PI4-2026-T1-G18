// src/core/layout/menu.js
import { clearSession } from '../session/storage.js';
import { irParaLogin } from '../session/login.js';
import { alternarTema, temaAtual } from '../theme/theme.js';
import { salvarPreferencias } from '../preferencias.js';


const CHAVE_MENU_RECOLHIDO = '@FinanceAI:menuRecolhido';

function rotuloTema() {
  return temaAtual() === 'claro' ? 'Tema escuro' : 'Tema claro';
}

/** Troca o texto de um botão do menu (o <span class="menu-texto">, que o botão recolhido esconde) e a dica do mouse. */
function definirRotulo(botao, texto) {
  const rotulo = botao.querySelector('.menu-texto');
  if (rotulo) rotulo.textContent = texto;
  else botao.textContent = texto;
  botao.title = texto;
}

function lerMenuRecolhido() {
  try {
    return localStorage.getItem(CHAVE_MENU_RECOLHIDO) === 'true';
  } catch {
    return false; // sem armazenamento (janela privada): o menu nasce aberto
  }
}

/** Liga o botão que recolhe o menu aos ícones e lembra a escolha no navegador. */
function ligarRecolher(raiz) {
  const botao = raiz.querySelector('#botao-recolher-menu');
  if (!botao) return;

  function aplicar(recolhido) {
    document.body.classList.toggle('menu-recolhido', recolhido);
    botao.setAttribute('aria-expanded', String(!recolhido));
    const rotulo = recolhido ? 'Expandir menu' : 'Recolher menu';
    botao.setAttribute('aria-label', rotulo);
    botao.title = rotulo;
  }

  aplicar(lerMenuRecolhido());
  botao.addEventListener('click', () => {
    const recolhido = !document.body.classList.contains('menu-recolhido');
    aplicar(recolhido);
    try {
      localStorage.setItem(CHAVE_MENU_RECOLHIDO, String(recolhido));
    } catch {
      // sem armazenamento: vale só até recarregar a página
    }
  });
}

export function ligarMenu(raiz = document) {
  const botaoTema = raiz.querySelector('#botao-tema');
  if (botaoTema) {
    definirRotulo(botaoTema, rotuloTema());
    botaoTema.addEventListener('click', (evento) => {
      const novoTema = temaAtual() === 'claro' ? 'escuro' : 'claro';
      salvarPreferencias({ tema: novoTema }).catch((erro) => {
        console.error('Erro ao salvar tema no MongoDB:', erro);
      });
      
      // Se o navegador não suportar View Transitions, troca direto
      if (!document.startViewTransition) {
        alternarTema();
        definirRotulo(botaoTema, rotuloTema());
        return;
      }

      // Pega o centro do botão ou a posição do clique para iniciar o círculo
      const rect = botaoTema.getBoundingClientRect();
      const x = evento.clientX || rect.left + rect.width / 2;
      const y = evento.clientY || rect.top + rect.height / 2;

      // Calcula o raio até o canto mais distante da tela
      const raioMaximo = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transicao = document.startViewTransition(() => {
        alternarTema();
        definirRotulo(botaoTema, rotuloTema());
      });

      transicao.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${raioMaximo}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 550,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      });
    });
  }

  ligarRecolher(raiz);

  const botaoSair = raiz.querySelector('#botao-sair');
  if (botaoSair) {
    botaoSair.addEventListener('click', () => {
      clearSession();
      irParaLogin();
    });
  }
}