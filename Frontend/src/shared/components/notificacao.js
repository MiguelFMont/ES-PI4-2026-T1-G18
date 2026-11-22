/**
 * Notificações e confirmação, baseadas no alert.js do projeto PI_NotaDez (Miguel Fernandes Monteiro).
 *
 *   notificar('Transação salva.', 'sucesso')   faixa colorida que desliza pela direita e some em 5 segundos, com uma
 *                                              linha na base que se esvazia mostrando o tempo que falta
 *   notificar('Aguarde...', 'sucesso', { duracao: 3000, pausavel: false })   duração própria; devolve { fechar }
 *   await confirmar('Excluir?', 'erro')        janela com Cancelar e Confirmar; devolve true ou false
 *
 * `tipo` aceita 'sucesso', 'aviso' ou 'erro' (e os sinônimos 'success', 'warning', 'error', 'info' e 'notificacao').
 * Mexer o mouse sobre uma notificação ou focá-la pausa a linha de tempo (que é o relógio dela); ao sair, continua de onde
 * parou. A pausa dura no máximo 10 s de uma vez.
 * Opções de notificar: `duracao` em ms (0 = fica até ser fechada, sem linha de tempo), `pausavel` (padrão true) e `acao`
 * ({ rotulo, aoClicar }): um botão dentro da notificação, como "Desfazer". Ele some junto com a notificação quando o tempo acaba;
 * ao clicar, roda `aoClicar` (pode ser assíncrona) e a notificação fecha.
 * O estilo está em shared/styles/notificacao.css (carregado pelo index.html e pelas páginas de features/auth).
 * Diferenças do original: várias notificações podem aparecer juntas (uma embaixo da outra) em vez de uma substituir
 * a outra, a mensagem entra sempre como texto, e a confirmação devolve uma Promise em vez de receber um callback.
 */
import { liberarRolagem, travarRolagem } from '../utils/rolagem.js';

const DURACAO_MS = 5000;
const DURACAO_ANIMACAO_MS = 140; // a saída dura 0,12 s (notificacao.css)
// Quanto a notificação pode ficar parada (mouse ou foco em cima dela) de uma vez. Passou disso, o tempo volta a correr:
// uma pausa esquecida (cursor parado em cima, toque na tela, foco que não sai) nunca prende a notificação para sempre.
const PAUSA_MAXIMA_MS = 10000;

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

/**
 * Pausa a linha de tempo enquanto o mouse se mexe sobre a notificação ou o foco do teclado está dentro dela, e retoma de
 * onde parou. Só conta o mouse de verdade: um toque na tela não pausa (não existe "sair de cima" no toque), e um cursor
 * parado no lugar onde a notificação apareceu também não (só vale se ele se mexer em cima dela).
 */
function ligarPausa(alerta, animacao) {
  const motivos = new Set(); // 'mouse' e/ou 'foco'
  let limite = null;

  const atualizar = () => {
    if (alerta.classList.contains('alerta--saindo')) return;
    if (motivos.size > 0) {
      if (animacao.playState !== 'running') return;
      animacao.pause();
      alerta.classList.add('alerta--pausado');
      limite = setTimeout(() => {
        motivos.clear();
        atualizar();
      }, PAUSA_MAXIMA_MS);
    } else {
      clearTimeout(limite);
      alerta.classList.remove('alerta--pausado');
      if (animacao.playState === 'paused') animacao.play();
    }
  };
  const marcar = (motivo, ligado) => {
    if (ligado === motivos.has(motivo)) return;
    if (ligado) motivos.add(motivo);
    else motivos.delete(motivo);
    atualizar();
  };

  alerta.addEventListener('pointermove', (evento) => {
    if (evento.pointerType === 'mouse' && (evento.movementX !== 0 || evento.movementY !== 0)) marcar('mouse', true);
  });
  alerta.addEventListener('pointerleave', () => marcar('mouse', false));
  alerta.addEventListener('pointercancel', () => marcar('mouse', false));
  alerta.addEventListener('focusin', () => marcar('foco', true));
  alerta.addEventListener('focusout', (evento) => {
    if (!alerta.contains(evento.relatedTarget)) marcar('foco', false);
  });
}

export function notificar(mensagem, tipo = 'sucesso', { duracao = DURACAO_MS, pausavel = true, acao = null } = {}) {
  const { classe, icone } = tipoDe(tipo);
  const persistente = !(duracao > 0);

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

  if (acao?.rotulo && typeof acao.aoClicar === 'function') {
    const botaoAcao = document.createElement('button');
    botaoAcao.type = 'button';
    botaoAcao.className = 'alerta__acao';
    botaoAcao.textContent = acao.rotulo;
    botaoAcao.addEventListener('click', async () => {
      botaoAcao.disabled = true; // um clique só
      try {
        await acao.aoClicar();
      } finally {
        encerrar();
      }
    });
    alerta.append(botaoAcao);
  }

  let animacao = null; // o relógio da notificação: a própria linha de tempo (ver abaixo)

  const encerrar = () => {
    if (alerta.classList.contains('alerta--saindo')) return;
    alerta.classList.add('alerta--saindo');
    animacao?.cancel();
    setTimeout(() => alerta.remove(), DURACAO_ANIMACAO_MS);
  };
  fechar.addEventListener('click', encerrar);

  if (!persistente) {
    // Linha de tempo: esvazia da direita para a esquerda e É o relógio da notificação: quando ela termina, a notificação
    // sai. Como a barra e o fechamento são a mesma animação, os dois nunca se separam (antes eram uma animação CSS e um
    // setTimeout, e a barra podia parar com a notificação ainda na tela). Pausar e retomar mexem só nela.
    const tempo = document.createElement('div');
    tempo.className = 'alerta__tempo';
    tempo.setAttribute('aria-hidden', 'true');
    const barra = document.createElement('div');
    barra.className = 'alerta__tempo-barra';
    tempo.append(barra);
    alerta.append(tempo);

    const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    animacao = barra.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: duracao, easing: semMovimento ? 'steps(10, end)' : 'linear', fill: 'forwards' }
    );
    animacao.onfinish = encerrar;

    if (pausavel) ligarPausa(alerta, animacao);
  }

  regiao().append(alerta);
  return { fechar: encerrar };
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
    travarRolagem(); // sem a barra sumir e deslocar a página (shared/utils/rolagem.js)
    cancelar.focus();

    function fechar(resultado) {
      document.removeEventListener('keydown', teclado, true);
      fundo.classList.add('confirmacao--saindo');
      setTimeout(() => {
        fundo.remove();
        liberarRolagem();
        anterior?.focus?.();
        resolver(resultado);
      }, 140); // a saída da confirmação dura 0,12 s (notificacao.css)
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
