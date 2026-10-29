/**
 * Notificações e confirmação, baseadas no alert.js do projeto PI_NotaDez (Miguel Fernandes Monteiro).
 *
 *   notificar('Transação salva.', 'sucesso')   faixa colorida que desliza pela direita e some em 5 segundos
 *   await confirmar('Excluir?', 'erro')        janela com Cancelar e Confirmar; devolve true ou false
 *
 * `tipo` aceita 'sucesso', 'aviso' ou 'erro' (e os sinônimos 'success', 'warning', 'error', 'info' e 'notificacao').
 * O estilo está em shared/styles/notificacao.css (carregado pelo index.html).
 * Diferenças do original: várias notificações podem aparecer juntas (uma embaixo da outra) em vez de uma substituir
 * a outra, a mensagem entra sempre como texto, e a confirmação devolve uma Promise em vez de receber um callback.
 */
const DURACAO_MS = 5000;
const DURACAO_ANIMACAO_MS = 300;

const TIPOS = {
  sucesso: { classe: 'sucesso', icone: '✓' },
  aviso: { classe: 'aviso', icone: '!' },
  erro: { classe: 'erro', icone: '✕' },
};
const SINONIMOS = { success: 'sucesso', warning: 'aviso', notificacao: 'aviso', info: 'aviso', error: 'erro', danger: 'erro' };

const tipoDe = (tipo) => TIPOS[SINONIMOS[String(tipo).toLowerCase()] ?? String(tipo).toLowerCase()] ?? TIPOS.sucesso;

function regiao() {
  let area = document.querySelector('#alertas');
  if (!area) {
    area = document.createElement('div');
    area.id = 'alertas';
    area.className = 'alertas';
    area.setAttribute('role', 'region');
    area.setAttribute('aria-label', 'Notificações');
    document.body.append(area);
  }
  return area;
}

export function notificar(mensagem, tipo = 'sucesso') {
  const { classe, icone } = tipoDe(tipo);

  const alerta = document.createElement('div');
  alerta.className = `alerta alerta--${classe}`;
  alerta.setAttribute('role', classe === 'erro' ? 'alert' : 'status');

  // O ícone do tipo é também o botão de fechar, como no original.
  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.className = 'alerta__fechar';
  fechar.setAttribute('aria-label', 'Fechar notificação');
  fechar.textContent = icone;

  const texto = document.createElement('p');
  texto.className = 'alerta__mensagem';
  texto.textContent = mensagem; // sempre como texto: a mensagem pode vir da API

  alerta.append(fechar, texto);

  let temporizador;
  const encerrar = () => {
    clearTimeout(temporizador);
    if (alerta.classList.contains('alerta--saindo')) return;
    alerta.classList.add('alerta--saindo');
    setTimeout(() => alerta.remove(), DURACAO_ANIMACAO_MS);
  };
  fechar.addEventListener('click', encerrar);
  temporizador = setTimeout(encerrar, DURACAO_MS);

  regiao().append(alerta);
}

/**
 * Janela de confirmação. Devolve uma Promise: true se o usuário confirmar, false se cancelar, apertar Esc ou clicar
 * fora. O foco começa em "Cancelar" (o mais seguro para ações que não dá para desfazer).
 */
export function confirmar(mensagem, tipo = 'aviso') {
  const { classe, icone } = tipoDe(tipo);
  const anterior = document.activeElement;

  return new Promise((resolver) => {
    const fundo = document.createElement('div');
    fundo.className = 'confirmacao';

    const janela = document.createElement('div');
    janela.className = `confirmacao__janela confirmacao__janela--${classe}`;
    janela.setAttribute('role', 'alertdialog');
    janela.setAttribute('aria-modal', 'true');
    janela.setAttribute('aria-describedby', 'confirmacao-mensagem');

    const conteudo = document.createElement('div');
    conteudo.className = 'confirmacao__conteudo';
    const marca = document.createElement('div');
    marca.className = 'confirmacao__icone';
    marca.setAttribute('aria-hidden', 'true');
    marca.textContent = icone;
    const texto = document.createElement('p');
    texto.className = 'confirmacao__mensagem';
    texto.id = 'confirmacao-mensagem';
    texto.textContent = mensagem;
    conteudo.append(marca, texto);

    const botoes = document.createElement('div');
    botoes.className = 'confirmacao__botoes';
    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'confirmacao__botao confirmacao__botao--cancelar';
    cancelar.textContent = 'Cancelar';
    const confirmarBotao = document.createElement('button');
    confirmarBotao.type = 'button';
    confirmarBotao.className = 'confirmacao__botao confirmacao__botao--confirmar';
    confirmarBotao.textContent = 'Confirmar';
    botoes.append(cancelar, confirmarBotao);

    janela.append(conteudo, botoes);
    fundo.append(janela);
    document.body.append(fundo);
    document.body.style.overflow = 'hidden';
    cancelar.focus();

    function fechar(resultado) {
      document.removeEventListener('keydown', teclado, true);
      fundo.classList.add('confirmacao--saindo');
      setTimeout(() => {
        fundo.remove();
        document.body.style.overflow = '';
        anterior?.focus?.();
        resolver(resultado);
      }, 200);
    }

    function teclado(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        fechar(false);
      } else if (evento.key === 'Tab') {
        // o Tab circula só entre os dois botões
        evento.preventDefault();
        (document.activeElement === cancelar ? confirmarBotao : cancelar).focus();
      }
    }

    cancelar.addEventListener('click', () => fechar(false));
    confirmarBotao.addEventListener('click', () => fechar(true));
    fundo.addEventListener('click', (evento) => {
      if (evento.target === fundo) fechar(false);
    });
    document.addEventListener('keydown', teclado, true);
  });
}
