import { aceitarSomenteNumeros } from '../../../../shared/components/campos.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { CATEGORIAS, FORMAS_PAGAMENTO, TIPOS } from '../../utils/constants.js';
import { LIMITE_OBSERVACOES, validarCampo } from '../../utils/formValidation.js';

const OPCOES = { categoria: CATEGORIAS, formaPagamento: FORMAS_PAGAMENTO, tipo: TIPOS };

/** O valor que a transação tem hoje naquele campo, no formato que o editor mostra. */
export function valorParaEditar(campo, transacao) {
  if (campo === 'data') return String(transacao.data).slice(0, 10);
  if (campo === 'valor') return String(transacao.valor).replace('.', ',');
  return transacao[campo] ?? '';
}

// Escolhe o controle de cada campo: lista para os de opções, calendário nativo para a data e texto para o resto.
function criarControle(campo, atual) {
  if (OPCOES[campo]) {
    const select = document.createElement('select');
    for (const { valor, rotulo } of OPCOES[campo]) select.add(new Option(rotulo, valor));
    select.value = atual;
    return select;
  }

  const input = document.createElement('input');
  input.type = campo === 'data' ? 'date' : 'text';
  input.value = atual;
  input.autocomplete = 'off';
  if (campo === 'valor') {
    input.inputMode = 'decimal';
    aceitarSomenteNumeros(input);
  }
  if (campo === 'observacoes') input.maxLength = LIMITE_OBSERVACOES;
  return input;
}

/**
 * Troca o botão de um campo do extrato por um campo de edição. Enter (ou sair do campo) salva, Esc cancela; nas
 * listas, escolher uma opção salva. Valor inválido mantém o campo aberto, com mensagem curta embaixo dele e uma
 * notificação geral. Valor igual ao atual só fecha.
 *   aoSalvar(valor) devolve uma Promise: se ela falhar, o campo continua aberto para tentar de novo (quem chama
 *   já mostrou a notificação do erro); se der certo, quem chama atualiza a lista e este campo deixa de existir.
 */
export function iniciarEdicao({ botao, campo, atual, aoSalvar }) {
  const controle = criarControle(campo, atual);
  const mensagem = document.createElement('p');
  mensagem.className = 'campo__erro extrato-editor__erro';
  mensagem.id = `erro-${campo}-${Math.random().toString(36).slice(2, 8)}`;
  mensagem.hidden = true;

  const editor = document.createElement('span');
  editor.className = `campo extrato-editor extrato-editor--${campo}`;
  controle.setAttribute('aria-label', `Editar ${botao.dataset.rotulo ?? campo}`);
  editor.append(controle, mensagem);

  const eLista = controle.tagName === 'SELECT';
  let encerrado = false;
  let salvando = false;
  const controladorFora = new AbortController();

  function encerrar({ devolverFoco = true } = {}) {
    encerrado = true;
    controladorFora.abort();
    editor.remove();
    botao.hidden = false;
    if (devolverFoco) botao.focus();
  }

  function mostrarErro(texto) {
    mensagem.textContent = texto;
    mensagem.hidden = false;
    controle.setAttribute('aria-invalid', 'true');
    controle.setAttribute('aria-describedby', mensagem.id);
  }

  async function confirmar() {
    if (encerrado || salvando) return;

    const { erro, valor } = validarCampo(campo, controle.value);
    if (erro) {
      mostrarErro(erro);
      notificar('Corrija o campo destacado.', 'erro');
      return;
    }
    if (String(valor) === String(validarCampo(campo, atual).valor)) {
      encerrar();
      return;
    }

    salvando = true;
    controle.disabled = true;
    try {
      await aoSalvar(valor);
      if (!encerrado) encerrar({ devolverFoco: false });
    } catch {
      salvando = false;
      controle.disabled = false;
      controle.focus();
    }
  }

  controle.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      encerrar();
    } else if (evento.key === 'Enter' && !eLista) {
      evento.preventDefault();
      confirmar();
    }
  });

  if (eLista) {
    controle.addEventListener('change', confirmar);
    // A lista aberta tira o foco do select, então aqui um clique fora é que cancela a edição.
    document.addEventListener('pointerdown', (evento) => {
      if (!evento.composedPath().includes(editor) && !salvando) encerrar({ devolverFoco: false });
    }, { capture: true, signal: controladorFora.signal });
  } else {
    controle.addEventListener('blur', () => setTimeout(confirmar, 0)); // espera: um Esc ou um clique em outro botão passa antes
  }

  // O editor ocupa exatamente o espaço do campo clicado: nada ao redor muda de lugar nem de tamanho.
  const caixa = botao.getBoundingClientRect();
  editor.style.width = `${caixa.width}px`;
  editor.style.height = `${caixa.height}px`;

  botao.hidden = true;
  botao.after(editor);
  controle.focus();
  if (eLista) controle.showPicker?.();
}
