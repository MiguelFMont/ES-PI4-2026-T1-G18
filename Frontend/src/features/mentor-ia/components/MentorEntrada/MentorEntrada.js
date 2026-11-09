const ALTURA_MAXIMA_PX = 160; // o campo cresce com o texto até umas 6 linhas; depois rola por dentro

/**
 * Liga a lógica ao campo da pergunta (HTML em MentorEntrada.html). `aoEnviar(texto)` recebe a pergunta já sem
 * espaços nas pontas. O botão nasce desativado: a tela libera com `bloquear(false)` quando a conversa carrega.
 */
export function iniciarEntrada(raiz, { aoEnviar }) {
  const formulario = raiz.querySelector('#mentor-entrada');
  const campo = raiz.querySelector('#mentor-texto');
  const botao = raiz.querySelector('#mentor-enviar');
  const contador = raiz.querySelector('#mentor-contador');

  function atualizar() {
    contador.textContent = `${campo.value.length}/${campo.maxLength}`;
    campo.style.height = 'auto';
    campo.style.height = `${Math.min(campo.scrollHeight, ALTURA_MAXIMA_PX)}px`;
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = campo.value.trim();
    if (botao.disabled) return;
    if (!texto) {
      campo.focus();
      return;
    }
    aoEnviar(texto);
  });

  // Enter envia; Shift + Enter quebra a linha. Durante a composição de acentos (isComposing) o Enter é do teclado.
  campo.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) {
      evento.preventDefault();
      formulario.requestSubmit();
    }
  });

  campo.addEventListener('input', atualizar);

  return {
    /** Desativa o botão enquanto a conversa carrega ou o Mentor pensa (dá para continuar digitando). */
    bloquear(sim) {
      botao.disabled = sim;
    },
    limpar() {
      campo.value = '';
      atualizar();
    },
    /** Devolve a pergunta ao campo quando o envio falha, sem apagar o que o usuário já começou a digitar. */
    preencher(texto) {
      if (campo.value.trim()) return;
      campo.value = texto;
      atualizar();
    },
    focar() {
      campo.focus();
    },
  };
}
