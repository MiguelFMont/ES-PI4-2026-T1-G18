import { buscarHistorico, enviarMensagem } from '../../services/mentorIaService.js';
import { notificar } from '../../../../shared/components/notificacao.js';
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

/**
 * Liga a lógica da página do Mentor IA ao HTML de views/mentor-ia.html (já dentro do container): carrega o
 * histórico, envia as perguntas e mostra as respostas. `signal` (de um AbortController) avisa que a tela foi
 * desmontada: a carga do histórico é cancelada e uma resposta que ainda esteja a caminho deixa de mexer na tela
 * (a pergunta e a resposta continuam salvas no Backend e aparecem no histórico da próxima visita).
 */
export function iniciarPaginaMentor(raiz, { signal } = {}) {
  let ocupado = false; // uma pergunta por vez: a próxima só sai depois da resposta

  const conversa = iniciarConversa(raiz, {
    tentarNovamente: () => carregarHistorico(),
    escolherSugestao: (texto) => perguntar(texto),
  });
  const entrada = iniciarEntrada(raiz, { aoEnviar: (texto) => perguntar(texto) });

  async function carregarHistorico() {
    conversa.mostrarCarregando();
    try {
      const mensagens = await buscarHistorico({ signal });
      if (signal?.aborted) return;
      conversa.mostrarHistorico(mensagens);
      entrada.bloquear(false);
      entrada.focar();
    } catch (erro) {
      if (signal?.aborted) return;
      conversa.mostrarErro(erro);
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
