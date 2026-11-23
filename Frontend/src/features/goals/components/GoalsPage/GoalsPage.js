import { atualizarMeta, criarMeta, excluirMeta, listarMetas } from '../../services/goalsService.js';
import { notificar, confirmar } from '../../../../shared/components/notificacao.js';
import { iniciarFormulario } from '../GoalForm/GoalForm.js';
import { iniciarLista } from '../GoalList/GoalList.js';

// Erros da API com um texto para o usuário; os demais mostram a mensagem da própria API (já em português).
const MENSAGENS_DE_ERRO = {
  GOAL_NOT_FOUND: 'Essa meta não existe mais (talvez já tenha sido excluída).',
  JAVA_SERVER_UNAVAILABLE: 'O servidor de cálculos está fora do ar. Tente de novo em instantes.',
};

const mensagemDeErro = (erro, padrao) => MENSAGENS_DE_ERRO[erro?.code] ?? erro?.message ?? padrao;

/**
 * Liga a página de Metas ao HTML de views/goals.html (já dentro do container): o formulário (criar e editar) e a lista com
 * o progresso de cada meta. A estrutura da tela está toda no HTML; aqui ficam só as partes que mudam com os dados.
 * `signal` (de um AbortController) avisa que a tela foi desmontada.
 */
export function iniciarPaginaMetas(raiz, { signal } = {}) {
  const estado = { sequencia: 0 };

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const formulario = iniciarFormulario(raiz, { signal, enviar: salvar });
  const lista = iniciarLista(raiz, {
    signal,
    aoEditar: (meta) => formulario.abrirEdicao(meta),
    aoExcluir: excluir,
    tentarNovamente: () => carregar(),
  });

  /** Busca as metas. `silencioso` atualiza sem trocar a lista por "Carregando..." (depois de salvar ou excluir). */
  async function carregar({ silencioso = false } = {}) {
    const minha = ++estado.sequencia; // ignora respostas antigas
    if (!silencioso) lista.iniciarCarga();

    try {
      const metas = await listarMetas();
      if (minha === estado.sequencia) lista.mostrarMetas(metas);
    } catch (erro) {
      if (minha === estado.sequencia) lista.mostrarErro(mensagemDeErro(erro, 'Não foi possível carregar as metas.'));
    }
  }

  // Cria ou edita. Se falhar, avisa e devolve o erro: o formulário continua aberto e mostra os erros de campo.
  async function salvar(dados, id) {
    try {
      if (id) await atualizarMeta(id, dados);
      else await criarMeta(dados);
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível salvar a meta.'), 'erro');
      throw erro;
    }
    notificar(id ? 'Meta atualizada.' : 'Meta criada.', 'sucesso');
    await carregar({ silencioso: true });
  }

  async function excluir(meta) {
    const confirmado = await confirmar(
      `Excluir a meta "${meta.titulo}"?`,
      'aviso'
    );
    if (!confirmado) return;

    try {
      await excluirMeta(meta.id);
      notificar('Meta excluída.', 'sucesso');
    } catch (erro) {
      notificar(mensagemDeErro(erro, 'Não foi possível excluir a meta.'), 'erro');
    }
    await carregar({ silencioso: true });
  }

  carregar();
}
