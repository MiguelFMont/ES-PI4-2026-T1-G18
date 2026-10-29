/**
 * Liga a lógica aos campos de formulário que já estão escritos no HTML da tela.
 * O HTML de cada campo segue este formato (o id do erro é sempre `<id>-erro`):
 *
 *   <div class="campo">
 *     <label for="campo-valor">Valor *</label>
 *     <input id="campo-valor" ...>
 *     <p class="campo__erro" id="campo-valor-erro" hidden></p>
 *   </div>
 */

/** Devolve { controle, ler(), definir(valor), definirErro(mensagem), focar() } do campo com esse id. */
export function ligarCampo(raiz, id) {
  const controle = raiz.querySelector(`#${id}`);
  const erro = raiz.querySelector(`#${id}-erro`);

  return {
    controle,
    focar: () => controle.focus(),
    ler: () => controle.value,
    definir: (valor) => {
      controle.value = valor;
    },
    definirErro(mensagem) {
      erro.hidden = !mensagem;
      erro.textContent = mensagem ?? '';
      if (mensagem) {
        controle.setAttribute('aria-invalid', 'true');
        controle.setAttribute('aria-describedby', erro.id);
      } else {
        controle.removeAttribute('aria-invalid');
        controle.removeAttribute('aria-describedby');
      }
    },
  };
}

/**
 * Faz o campo aceitar só dígitos, vírgula e ponto (valores em dinheiro). Impede a digitação de letras e limpa o que
 * for colado. Só restringe os caracteres; se o número faz sentido, quem valida é o formulário.
 */
export function aceitarSomenteNumeros(controle) {
  const PERMITIDOS = /^[\d.,]*$/;
  controle.addEventListener('beforeinput', (evento) => {
    if (evento.data && !PERMITIDOS.test(evento.data)) evento.preventDefault();
  });
  controle.addEventListener('input', () => {
    const limpo = controle.value.replace(/[^\d.,]/g, '');
    if (limpo !== controle.value) controle.value = limpo; // colar texto com letras
  });
}

/**
 * Máscara de valor em dinheiro: os dígitos entram pelos centavos e o campo já mostra o valor formatado.
 * Digitar 1 mostra "0,01"; depois 1 de novo, "0,11"; depois 5, "1,15"; e assim por diante (com ponto nos milhares).
 * Letras e símbolos são ignorados, inclusive ao colar. Apagar tira o último dígito.
 */
export function aplicarMascaraMoeda(controle) {
  const LIMITE_DIGITOS = 11; // até 999.999.999,99
  controle.addEventListener('beforeinput', (evento) => {
    if (evento.data && /\D/.test(evento.data)) evento.preventDefault();
  });
  controle.addEventListener('input', () => {
    const digitos = controle.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, LIMITE_DIGITOS);
    if (!digitos) {
      controle.value = '';
      return;
    }
    const centavos = digitos.padStart(3, '0');
    const inteiro = centavos.slice(0, -2).replace(/\B(?=(\d{3})+$)/g, '.');
    controle.value = `${inteiro},${centavos.slice(-2)}`;
  });
}
