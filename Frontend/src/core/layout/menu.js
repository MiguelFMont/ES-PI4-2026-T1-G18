import { clearSession } from '../session/storage.js';
import { irParaLogin } from '../session/login.js';
import { alternarTema, temaAtual } from '../theme/theme.js';

function rotuloTema() {
  return temaAtual() === 'claro' ? 'Tema escuro' : 'Tema claro';
}

/**
 * Liga os botões do menu lateral que já está escrito no HTML da página (#botao-tema e #botao-sair).
 * Os links do menu ficam no próprio HTML de cada página; cada feature acrescenta o seu lá.
 */
export function ligarMenu(raiz = document) {
  const botaoTema = raiz.querySelector('#botao-tema');
  botaoTema.textContent = rotuloTema();
  botaoTema.addEventListener('click', () => {
    alternarTema();
    botaoTema.textContent = rotuloTema();
  });

  raiz.querySelector('#botao-sair').addEventListener('click', () => {
    clearSession();
    irParaLogin();
  });
}
