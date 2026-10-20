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
