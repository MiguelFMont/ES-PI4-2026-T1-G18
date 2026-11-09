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

  const sugestoes = [...raiz.querySelectorAll('.mentor-sugestao')];

  raiz.querySelector('#conversa-tentar-novamente').addEventListener('click', () => tentarNovamente());
  for (const botao of sugestoes) {
    botao.addEventListener('click', () => escolherSugestao(botao.textContent.trim()));
  }

  // As boas-vindas ficam enquanto o usuário não perguntou nada. Se o Mentor já mandou um insight sozinho, a lista
  // aparece junto, embaixo das sugestões (que continuam à mão para a primeira pergunta).
  function mostrar(estado) {
    const comInsights = estado === 'boas-vindas' && lista.childElementCount > 0;
    carregando.hidden = estado !== 'carregando';
    erro.hidden = estado !== 'erro';
    boasVindas.hidden = estado !== 'boas-vindas';
    lista.hidden = !(estado === 'mensagens' || comInsights);
    area.classList.toggle('mentor-conversa--boas-vindas-com-insight', comInsights);
    area.setAttribute('aria-busy', String(estado === 'carregando'));
  }

  const semPerguntas = () => !lista.querySelector('.mentor-mensagem--usuario');
  const estadoDaConversa = () => (semPerguntas() ? 'boas-vindas' : 'mensagens');

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
      mostrar(estadoDaConversa());
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
          mostrar(estadoDaConversa()); // era a primeira pergunta: voltam as boas-vindas (com os insights, se houver)
        },
      };
    },

    adicionarResposta(resposta) {
      adicionar(resposta);
      rolarParaOFim();
    },

    /**
     * Acrescenta as explicações que o Mentor mandou sem pergunta (POST /mentor-ia/chat/proativa) no fim da conversa.
     * Uma mensagem que já esteja na tela (mesmo id) não é repetida.
     */
    adicionarProativas(mensagens) {
      const novas = mensagens.filter((m) => ![...lista.children].some((item) => item.dataset.id === String(m.id)));
      if (novas.length === 0) return;
      for (const mensagem of novas) adicionar(mensagem);
      mostrar(estadoDaConversa());
      rolarParaOFim();
    },

    /** Mostra o "pensando". Enquanto ele aparece, as sugestões ficam desativadas (uma pergunta por vez). */
    pensando(ativo) {
      pensando.hidden = !ativo;
      for (const botao of sugestoes) botao.disabled = ativo;
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
  if (mensagem.id != null) item.dataset.id = String(mensagem.id);

  const autor = item.querySelector('.mentor-mensagem__autor');
  autor.querySelector('.mentor-mensagem__nome').textContent = daIa ? 'Mentor' : 'Você';
  if (!daIa) autor.classList.add('so-leitor'); // o balão do usuário já se distingue pela posição e pela cor

  // Explicação que o Mentor mandou sem pergunta: selo "Insight" ao lado do nome e um friso no balão.
  if (daIa && mensagem.proativa === true) {
    item.classList.add('mentor-mensagem--proativa');
    autor.querySelector('.mentor-mensagem__selo').hidden = false;
  }

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
