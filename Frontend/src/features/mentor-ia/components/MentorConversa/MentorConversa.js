import { formatarHorario } from '../../utils/format.js';
import { markdownParaElementos } from '../../utils/markdown.js';

/**
 * Liga a lógica à conversa (HTML em MentorConversa.html). A estrutura e os estados (carregando, erro, boas-vindas
 * e mensagens) estão no HTML; aqui só se escolhe qual mostrar e se preenchem as mensagens.
 *   tentarNovamente() é chamado pelo botão do estado de erro;
 *   escolherSugestao(texto) é chamado ao clicar numa das perguntas sugeridas.
 */
export function iniciarConversa(raiz, { tentarNovamente, escolherSugestao }) {
  const area = raiz.querySelector('#mentor-conversa');
  const carregando = raiz.querySelector('#conversa-carregando');
  const erro = raiz.querySelector('#conversa-erro');
  const boasVindas = raiz.querySelector('#conversa-boas-vindas');
  const lista = raiz.querySelector('#conversa-mensagens');
  const pensando = raiz.querySelector('#conversa-pensando');
  const modelo = raiz.querySelector('#modelo-mensagem');

  raiz.querySelector('#conversa-tentar-novamente').addEventListener('click', () => tentarNovamente());
  for (const botao of raiz.querySelectorAll('.mentor-sugestao')) {
    botao.addEventListener('click', () => escolherSugestao(botao.textContent.trim()));
  }

  function mostrar(estado) {
    carregando.hidden = estado !== 'carregando';
    erro.hidden = estado !== 'erro';
    boasVindas.hidden = estado !== 'boas-vindas';
    lista.hidden = estado !== 'mensagens';
    area.setAttribute('aria-busy', String(estado === 'carregando'));
  }

  const semMensagens = () => lista.childElementCount === 0;

  function rolarParaOFim() {
    area.scrollTop = area.scrollHeight;
  }

  function adicionar(mensagem) {
    const item = montarMensagem(modelo, mensagem);
    lista.append(item);
    return item;
  }

  return {
    mostrarCarregando() {
      mostrar('carregando');
    },

    mostrarErro(falha) {
      // Falha de rede já vem com mensagem amigável do api.js; os demais erros ganham um texto genérico.
      raiz.querySelector('#conversa-erro-texto').textContent = falha?.status
        ? 'Não foi possível carregar a conversa.'
        : (falha?.message ?? 'Erro inesperado.');
      mostrar('erro');
    },

    /** `mensagens`: o histórico de GET /mentor-ia/chat, da mais antiga para a mais nova. */
    mostrarHistorico(mensagens) {
      lista.replaceChildren(...mensagens.map((m) => montarMensagem(modelo, m)));
      mostrar(semMensagens() ? 'boas-vindas' : 'mensagens');
      rolarParaOFim();
    },

    /**
     * Mostra a pergunta enquanto o Mentor pensa (ainda não salva). Devolve `confirmar(pergunta)`, que a troca pela
     * versão salva pelo Backend, e `remover()`, para quando o envio falhar (nada foi salvo).
     */
    adicionarPergunta(texto) {
      const item = adicionar({ autor: 'usuario', texto, criadaEm: new Date().toISOString() });
      item.classList.add('mentor-mensagem--pendente');
      mostrar('mensagens');
      rolarParaOFim();
      return {
        confirmar(pergunta) {
          item.classList.remove('mentor-mensagem--pendente');
          preencherHorario(item, pergunta.criadaEm);
        },
        remover() {
          item.remove();
          if (semMensagens()) mostrar('boas-vindas');
        },
      };
    },

    adicionarResposta(resposta) {
      adicionar(resposta);
      rolarParaOFim();
    },

    pensando(ativo) {
      pensando.hidden = !ativo;
      if (ativo) rolarParaOFim();
    },
  };
}

function preencherHorario(item, iso) {
  const horario = item.querySelector('.mentor-mensagem__horario');
  horario.dateTime = iso;
  horario.textContent = formatarHorario(iso);
}

/** Uma mensagem, copiada do <template> do HTML. Os textos entram por textContent, nunca como HTML. */
function montarMensagem(modelo, mensagem) {
  const item = modelo.content.firstElementChild.cloneNode(true);
  const daIa = mensagem.autor === 'ia';
  item.classList.add(daIa ? 'mentor-mensagem--ia' : 'mentor-mensagem--usuario');

  const autor = item.querySelector('.mentor-mensagem__autor');
  autor.textContent = daIa ? 'Mentor' : 'Você';
  if (!daIa) autor.classList.add('so-leitor'); // o balão do usuário já se distingue pela posição e pela cor

  const texto = item.querySelector('.mentor-mensagem__texto');
  if (daIa) {
    texto.append(markdownParaElementos(mensagem.texto)); // **negrito** e listas com "-", como diz o contrato
  } else {
    const paragrafo = document.createElement('p');
    paragrafo.textContent = mensagem.texto;
    texto.append(paragrafo);
  }

  preencherHorario(item, mensagem.criadaEm);
  return item;
}
