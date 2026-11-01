import { atualizarTransacoesEmLote, excluirTransacoesEmLote, listarTransacoes } from '../../services/transactionsService.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { ligarSeletores } from '../../../../shared/components/seletor.js';
import { iniciarFormulario } from '../TransactionForm/TransactionForm.js';
import { iniciarFiltros } from '../TransactionFilters/TransactionFilters.js';
import { iniciarExtrato } from '../TransactionExtrato/TransactionExtrato.js';
import { iniciarResumo } from '../TransactionResumo/TransactionResumo.js';

const ITENS_POR_PAGINA_INICIAL = 20;

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
    salvarAlteracoes: (itens) => enviarLote(() => atualizarTransacoesEmLote(itens), {
      sucesso: (n) => (n === 1 ? 'Transação alterada.' : `${n} transações alteradas.`),
      falha: 'Não foi possível salvar as alterações.',
    }),
    editarVarias: (transacoes, mudancas) => enviarLote(
      () => atualizarTransacoesEmLote(transacoes.map((t) => ({ id: t.id, alteracoes: mudancas }))),
      {
        sucesso: (n) => (n === 1 ? 'Transação alterada.' : `${n} transações alteradas.`),
        falha: 'Não foi possível alterar as transações.',
      }
    ),
    excluirVarias: (transacoes) => enviarLote(() => excluirTransacoesEmLote(transacoes.map((t) => t.id)), {
      sucesso: (n) => (n === 1 ? 'Transação excluída.' : `${n} transações excluídas.`),
      falha: 'Não foi possível excluir as transações.',
    }),
  });

  // Chama um endpoint em lote, avisa o resultado e atualiza a lista. O lote não é tudo ou nada: ids que não existem
  // mais voltam em `naoEncontradas` e contam como falha parcial. Se a chamada falhar, o erro segue para quem chamou.
  async function enviarLote(chamada, textos) {
    let resultado;
    try {
      resultado = await chamada();
    } catch (erro) {
      notificar(erro?.status ? textos.falha : (erro?.message ?? 'Erro inesperado.'), 'erro');
      throw erro;
    }

    const { afetadas, naoEncontradas } = resultado;
    if (naoEncontradas.length === 0) notificar(textos.sucesso(afetadas), 'sucesso');
    else if (afetadas === 0) notificar(`${textos.falha} As transações não foram encontradas (talvez já tenham sido excluídas).`, 'erro');
    else notificar(`${afetadas} concluídas e ${naoEncontradas.length} não encontradas (talvez já tenham sido excluídas).`, 'erro');

    await carregar(estado.pagina);
    return resultado;
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

  // Recarregar ou fechar a página com alterações não confirmadas pede confirmação ao navegador. A troca de tela
  // dentro do SPA é tratada pelo roteador (app/main.js), que pergunta usando temPendencias().
  window.addEventListener('beforeunload', (evento) => {
    if (!extrato.temPendencias()) return;
    evento.preventDefault();
    evento.returnValue = '';
  }, { signal });

  return { temPendencias: () => extrato.temPendencias() };
}
