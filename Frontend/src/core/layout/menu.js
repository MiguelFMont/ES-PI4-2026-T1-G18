import { clearSession } from '../session/storage.js';
import { irParaLogin } from '../session/login.js';
import { alternarTema, temaAtual } from '../theme/theme.js';

// O texto do botão diz para qual tema ele leva: estando no claro, "Tema escuro".
const rotuloTema = (tema) => (tema === 'claro' ? 'Tema escuro' : 'Tema claro');

/**
 * Liga os botões do menu lateral que já está escrito no HTML da página (#botao-tema e #botao-sair).
 * Os links do menu ficam no próprio HTML de cada página; cada feature acrescenta o seu lá.
 */
export function ligarMenu(raiz = document) {
  const botaoTema = raiz.querySelector('#botao-tema');
  botaoTema.textContent = rotuloTema(temaAtual());
  botaoTema.addEventListener('click', () => {
    // o texto do botão muda junto com a troca, dentro da animação
    alternarTema({ origem: botaoTema, aoAplicar: (novo) => (botaoTema.textContent = rotuloTema(novo)) });
  });

  raiz.querySelector('#botao-sair').addEventListener('click', () => {
    clearSession();
    irParaLogin();
  });
}
