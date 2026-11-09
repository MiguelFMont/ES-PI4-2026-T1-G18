import {
  buscarAlertas,
  buscarExplicacaoProativa,
  buscarHistorico,
  enviarMensagem,
  marcarAlertaComoLido,
} from '../../services/mentorIaService.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { iniciarAlertas } from '../MentorAlertas/MentorAlertas.js';
import { iniciarConversa } from '../MentorConversa/MentorConversa.js';
import { iniciarEntrada } from '../MentorEntrada/MentorEntrada.js';

// Erros de POST /mentor-ia/chat (docs/contrato-api.md, seção 3.2) com um texto para o usuário.
const MENSAGENS_DE_ERRO = {
  VALIDATION_ERROR: 'A pergunta precisa ter de 1 a 2000 caracteres.',
  GENAI_RATE_LIMITED: 'O limite de uso do Mentor acabou por agora. Tente de novo em alguns minutos.',
  GENAI_ERROR: 'O Mentor não conseguiu responder. Tente de novo.',
  GENAI_UNAVAILABLE: 'O Mentor está indisponível no momento. Tente de novo em instantes.',
  JAVA_SERVER_UNAVAILABLE: 'O servidor de cálculos está fora do ar, então o Mentor não consegue analisar seus gastos agora.',
};

function mensagemDeErro(erro) {
  if (MENSAGENS_DE_ERRO[erro?.code]) return MENSAGENS_DE_ERRO[erro.code];
  // Falha de rede já vem com mensagem amigável do api.js; os demais erros ganham um texto genérico.
  return erro?.status ? 'Não foi possível enviar a pergunta. Tente de novo.' : (erro?.message ?? 'Erro inesperado.');
}

// Se o insight da abertura responder antes disso (o caso comum quando não há padrão novo e a rota devolve []), o
// "pensando" nem aparece: evita um piscar a cada visita.
const ESPERA_PARA_MOSTRAR_PENSANDO_MS = 400;

/**
 * Liga a lógica da página do Mentor IA ao HTML de views/mentor-ia.html (já dentro do container): carrega o
 * histórico, os alertas e o insight da abertura, envia as perguntas e mostra as respostas. `signal` (de um
 * AbortController) avisa que a tela foi desmontada: as cargas são canceladas e uma resposta que ainda esteja a
 * caminho deixa de mexer na tela (o que o Backend já salvou aparece no histórico da próxima visita).
 */
export function iniciarPaginaMentor(raiz, { signal } = {}) {
  let ocupado = false; // uma pergunta por vez (o insight da abertura também conta): a próxima só sai depois da resposta

  const conversa = iniciarConversa(raiz, {
    tentarNovamente: () => carregarHistorico(),
    escolherSugestao: (texto) => perguntar(texto),
  });
  const entrada = iniciarEntrada(raiz, { aoEnviar: (texto) => perguntar(texto) });
  const alertas = iniciarAlertas(raiz, {
    entender: (alerta) => marcarComoLido(alerta),
    aoEsvaziar: () => entrada.focar(), // o último alerta saiu: o foco vai para o campo da pergunta
    signal,
  });

  // Com a conversa na tela, o Mentor puxa o assunto sozinho: os alertas e um insight. Só passa por aqui uma vez por
  // montagem (o "Tentar novamente" só existe enquanto o histórico não carregou).
  async function carregarHistorico() {
    conversa.mostrarCarregando();
    try {
      const mensagens = await buscarHistorico({ signal });
      if (signal?.aborted) return;
      conversa.mostrarHistorico(mensagens);
      entrada.focar();
    } catch (erro) {
      if (signal?.aborted) return;
      conversa.mostrarErro(erro);
      return;
    }
    carregarAlertas();
    pedirExplicacaoProativa(); // libera o Enviar quando terminar
  }

  // Alertas (gasto fora do padrão, fatura próxima, dinheiro parado) no topo do chat, sem o usuário pedir. Não
  // dependem da IA, então chegam rápido. Se a listagem falhar, a faixa só não aparece: o chat segue normal.
  async function carregarAlertas() {
    try {
      const lista = await buscarAlertas({ signal });
      if (signal?.aborted) return;
      alertas.mostrar(Array.isArray(lista) ? lista : []);
    } catch (erro) {
      if (!signal?.aborted) console.warn('Mentor IA: não foi possível carregar os alertas.', erro);
    }
  }

  // "Entendi" num alerta. Devolve true para o cartão sair; se falhar, avisa e o botão volta para tentar de novo.
  async function marcarComoLido(alerta) {
    try {
      await marcarAlertaComoLido(alerta.id);
      return true;
    } catch (erro) {
      if (erro?.code === 'ALERT_NOT_FOUND') return true; // o alerta já deixou de valer no Backend: só sai da tela
      if (!signal?.aborted) {
        // Falha de rede já vem com mensagem amigável do api.js; os demais erros ganham um texto genérico.
        notificar(
          erro?.status ? 'Não foi possível marcar o alerta como lido. Tente de novo.' : (erro?.message ?? 'Erro inesperado.'),
          'erro'
        );
      }
      return false;
    }
  }

  // Insight da abertura: o Mentor comenta um padrão dos gastos sem esperar pergunta. Quando não há padrão novo a
  // rota devolve [] e nada aparece. Demora como uma resposta (até 20 s), então usa o mesmo "pensando" e segura o
  // Enviar e as sugestões, como numa pergunta: o Backend salva o insight no histórico, e uma pergunta enviada ao
  // mesmo tempo ficaria fora de ordem nele (e a IA responderia sem ver o insight). O campo continua livre para ir
  // digitando. É um extra: se falhar, a conversa segue como antes, sem aviso ao usuário.
  async function pedirExplicacaoProativa() {
    ocupado = true;
    entrada.bloquear(true);
    const aviso = setTimeout(() => conversa.pensando(true), ESPERA_PARA_MOSTRAR_PENSANDO_MS);

    try {
      const resposta = await buscarExplicacaoProativa({ signal });
      if (signal?.aborted) return;
      conversa.adicionarProativas(Array.isArray(resposta?.mensagens) ? resposta.mensagens : []);
    } catch (erro) {
      if (!signal?.aborted) console.warn('Mentor IA: explicação proativa indisponível.', erro);
    } finally {
      clearTimeout(aviso);
      if (!signal?.aborted) {
        ocupado = false;
        conversa.pensando(false);
        entrada.bloquear(false);
      }
    }
  }

  // A pergunta aparece como pendente enquanto o Mentor pensa (de 1 a 5 s, até 20). Só fica na conversa depois que o
  // Backend responde; se der erro, nada foi salvo: ela sai da conversa e volta para o campo, para tentar de novo.
  async function perguntar(texto) {
    if (ocupado) return;
    ocupado = true;
    entrada.bloquear(true);
    entrada.limpar();
    const pendente = conversa.adicionarPergunta(texto);
    conversa.pensando(true);

    try {
      const { pergunta, resposta } = await enviarMensagem(texto);
      if (signal?.aborted) return;
      pendente.confirmar(pergunta);
      conversa.adicionarResposta(resposta);
    } catch (erro) {
      if (signal?.aborted) return;
      pendente.remover();
      entrada.preencher(texto);
      notificar(mensagemDeErro(erro), 'erro');
    } finally {
      if (!signal?.aborted) {
        ocupado = false;
        conversa.pensando(false);
        entrada.bloquear(false);
        entrada.focar();
      }
    }
  }

  carregarHistorico();
}
