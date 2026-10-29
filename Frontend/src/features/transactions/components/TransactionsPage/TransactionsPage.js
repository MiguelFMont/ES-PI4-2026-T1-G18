import { atualizarTransacao, excluirTransacao, listarTransacoes } from '../../services/transactionsService.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { ligarSeletores } from '../../../../shared/components/seletor.js';
import { iniciarFormulario } from '../TransactionForm/TransactionForm.js';
import { iniciarFiltros } from '../TransactionFilters/TransactionFilters.js';
import { iniciarExtrato } from '../TransactionExtrato/TransactionExtrato.js';
import { iniciarResumo } from '../TransactionResumo/TransactionResumo.js';

const ITENS_POR_PAGINA_INICIAL = 20;

/** Corpo completo para a API (PUT) a partir de uma transação da lista e das mudanças. Observações vazias vão como "". */
function corpoDeEdicao(transacao, mudancas) {
  const { tipo, descricao, valor, categoria, formaPagamento, observacoes = '' } = { ...transacao, ...mudancas };
  const data = mudancas.data ?? String(transacao.data).slice(0, 10);
  return { tipo, descricao, valor, categoria, data, formaPagamento, observacoes };
}

/**
 * Liga a lógica da página de Transações (extrato) ao HTML de views/transactions.html (já dentro do container):
 * formulário de nova transação, filtros (a tela nasce filtrada pelo mês atual) e a lista paginada de receitas e
 * despesas, com o resumo de entradas, saídas e saldo e a edição e exclusão de transações. A estrutura da tela está
 * toda no HTML; aqui ficam só as partes que mudam com os dados. `signal` (de um AbortController) avisa que a tela foi
 * desmontada.
 */
export function iniciarPaginaTransacoes(raiz, { signal } = {}) {
  const estado = { parametros: {}, pagina: 1, limite: ITENS_POR_PAGINA_INICIAL, sequencia: 0 };

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const temFiltros = () => Object.keys(estado.parametros).length > 0;

  ligarSeletores(raiz, signal); // listas de Tipo, Categoria e Pagamento (filtros e formulário) e de "Por página"

  const resumo = iniciarResumo(raiz);
  const extrato = iniciarExtrato(raiz, {
    irParaPagina: (numero) => carregar(numero),
    tentarNovamente: () => carregar(estado.pagina),
    mudarLimite: (quantidade) => {
      estado.limite = quantidade;
      carregar(1);
    },
    editarCampo: async (transacao, campo, valor) => {
      try {
        await atualizarTransacao(transacao.id, corpoDeEdicao(transacao, { [campo]: valor }));
      } catch (erro) {
        notificar(erro?.status ? 'Não foi possível salvar a alteração.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
        throw erro; // o campo de edição continua aberto
      }
      notificar('Alteração salva.', 'sucesso');
      await carregar(estado.pagina);
    },
    editarVarias: (transacoes, mudancas) => executarEmLote(transacoes, (t) => atualizarTransacao(t.id, corpoDeEdicao(t, mudancas)), {
      sucesso: (n) => (n === 1 ? 'Transação alterada.' : `${n} transações alteradas.`),
      falha: 'Não foi possível alterar as transações.',
    }),
    excluirVarias: (transacoes) => executarEmLote(transacoes, (t) => excluirTransacao(t.id), {
      sucesso: (n) => (n === 1 ? 'Transação excluída.' : `${n} transações excluídas.`),
      falha: 'Não foi possível excluir as transações.',
    }),
  });

  // Não há endpoint em lote: faz uma chamada por transação e conta quantas deram certo.
  async function executarEmLote(transacoes, operacao, textos) {
    const resultados = await Promise.allSettled(transacoes.map(operacao));
    const falhas = resultados.filter((r) => r.status === 'rejected').length;
    const feitas = resultados.length - falhas;

    if (falhas === 0) notificar(textos.sucesso(feitas), 'sucesso');
    else if (feitas === 0) notificar(textos.falha, 'erro');
    else notificar(`${feitas} concluídas e ${falhas} com erro. Tente as restantes de novo.`, 'erro');

    await carregar(estado.pagina);
  }

  async function carregar(pagina) {
    const minha = ++estado.sequencia; // ignora respostas antigas se o usuário mudar os filtros rápido
    estado.pagina = pagina;
    extrato.iniciarCarga();

    try {
      const resposta = await listarTransacoes({ ...estado.parametros, pagina, limite: estado.limite });
      if (minha !== estado.sequencia) return;

      if (resposta.itens.length === 0 && resposta.total > 0 && pagina > 1) {
        // pediu uma página além da última (a lista encolheu): volta para a última
        await carregar(Math.max(1, resposta.totalPaginas));
        return;
      }
      extrato.mostrarResposta(resposta, { temFiltros: temFiltros() });
      resumo.atualizar(resposta.resumo);
    } catch (erro) {
      if (minha !== estado.sequencia) return;
      extrato.mostrarErro(erro);
    } finally {
      if (minha === estado.sequencia) extrato.finalizarCarga();
    }
  }

  iniciarFormulario(raiz, {
    signal,
    aoSalvar: async () => {
      if (temFiltros()) notificar('Se a transação não aparecer na lista, confira os filtros.', 'info');
      await carregar(1);
    },
  });

  // Os filtros já nascem com o mês atual e chamam aoMudar assim que são ligados: é a primeira consulta da tela.
  iniciarFiltros(raiz, {
    signal,
    aoMudar: (parametros) => {
      estado.parametros = parametros;
      carregar(1);
    },
  });
}
