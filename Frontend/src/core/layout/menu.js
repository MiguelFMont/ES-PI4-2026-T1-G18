// src/core/layout/menu.js
import { clearSession } from '../session/storage.js';
import { irParaLogin } from '../session/login.js';
import { alternarTema, temaAtual } from '../theme/theme.js';

function rotuloTema() {
  return temaAtual() === 'claro' ? 'Tema escuro' : 'Tema claro';
}

export function ligarMenu(raiz = document) {
  const botaoTema = raiz.querySelector('#botao-tema');
  if (botaoTema) {
    botaoTema.textContent = rotuloTema();
    botaoTema.addEventListener('click', (evento) => {
      // Se o navegador não suportar View Transitions, troca direto
      if (!document.startViewTransition) {
        alternarTema();
        botaoTema.textContent = rotuloTema();
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
        botaoTema.textContent = rotuloTema();
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

  const botaoSair = raiz.querySelector('#botao-sair');
  if (botaoSair) {
    botaoSair.addEventListener('click', () => {
      clearSession();
      irParaLogin();
    });
  }
}