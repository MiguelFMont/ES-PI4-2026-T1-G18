/**
 * Mensagens da validação nativa do navegador (campos com `required`, `type="email"`, `minlength`, `pattern`) em
 * português. O balão de aviso é escrito no idioma do navegador, não no `lang` da página: num Chrome em inglês o
 * cadastro mostrava "Please enter a part following '@'". Aqui a mensagem é trocada no momento em que o navegador vai
 * mostrá-la (evento `invalid`) e apagada assim que o usuário volta a digitar.
 *
 * Basta chamar uma vez por página: os ouvintes ficam no document e valem para todos os formulários dela, inclusive os
 * que entram depois (telas do SPA). Formulários com `novalidate` não passam por aqui (validam por conta própria).
 */
let ligado = false;

function mensagemDoEmail(valor) {
  const arroba = valor.indexOf('@');
  if (arroba === -1) return 'O e-mail precisa ter um @, como em nome@exemplo.com.';
  if (arroba === 0) return 'Falta o nome antes do @, como em nome@exemplo.com.';
  if (arroba === valor.length - 1) return 'Falta o endereço depois do @, como em nome@exemplo.com.';
  return 'Informe um e-mail válido, como nome@exemplo.com.';
}

function mensagemPara(campo) {
  const validade = campo.validity;
  if (validade.valueMissing) {
    if (campo.type === 'email') return 'Informe seu e-mail.';
    if (campo.tagName === 'SELECT') return 'Escolha uma opção da lista.';
    return 'Preencha este campo.';
  }
  if (validade.typeMismatch) return campo.type === 'email' ? mensagemDoEmail(campo.value) : 'Valor inválido.';
  if (validade.tooShort) return `Use pelo menos ${campo.minLength} caracteres (agora são ${campo.value.length}).`;
  if (validade.tooLong) return `Use no máximo ${campo.maxLength} caracteres.`;
  if (validade.patternMismatch) return campo.title || 'O formato não é o esperado.';
  return '';
}

export function traduzirValidacaoNativa() {
  if (ligado) return;
  ligado = true;

  // `invalid` não sobe pela árvore: só a captura no document recebe o de todos os campos.
  document.addEventListener('invalid', (evento) => {
    const campo = evento.target;
    if (typeof campo.setCustomValidity !== 'function') return;
    campo.setCustomValidity(''); // apaga a mensagem anterior para ler o motivo real
    campo.setCustomValidity(mensagemPara(campo));
  }, true);

  // A mensagem própria deixa o campo inválido até ser apagada: some ao digitar ou escolher outra opção.
  document.addEventListener('input', (evento) => {
    if (typeof evento.target.setCustomValidity === 'function') evento.target.setCustomValidity('');
  }, true);
}
