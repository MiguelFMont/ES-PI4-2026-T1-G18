import { atualizarTransacoesEmLote, duplicarTransacoes, excluirTransacoesEmLote, listarTransacoes } from '../../services/transactionsService.js';
import { notificar, confirmar } from '../../../../shared/components/notificacao.js';
import { listarMetas } from '../../../goals/services/goalsService.js';
import { ligarSeletores } from '../../../../shared/components/seletor.js';
import { iniciarFormulario } from '../TransactionForm/TransactionForm.js';
import { iniciarBarra } from '../TransactionBarra/TransactionBarra.js';
import { iniciarLista } from '../TransactionLista/TransactionLista.js';
import { iniciarDetalhe } from '../TransactionDetalhe/TransactionDetalhe.js';
import { validarCampo } from '../../utils/formValidation.js';

const POR_PAGINA = 100; // as transações de um mês cabem numa página quase sempre; "Carregar mais" pede a seguinte

/**
 * Liga a lógica da página de Transações ao HTML de views/transactions.html (já dentro do container): a barra do topo (mês,
 * filtros e busca), a lista do mês agrupada por dia, o painel de detalhes (editar, duplicar e excluir uma transação) e o
 * formulário de nova transação. A estrutura da tela está toda no HTML; aqui ficam só as partes que mudam com os dados.
 * `signal` (de um AbortController) avisa que a tela foi desmontada.
 */
export function iniciarPaginaTransacoes(raiz, { signal } = {}) {
  let barra; // ligados mais abaixo; as metas podem chegar antes ou depois
  let detalhe;
  const estado = { parametros: {}, pagina: 1, sequencia: 0 };

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const temFiltros = () => Object.keys(estado.parametros).some((chave) => chave !== 'dataInicio' && chave !== 'dataFim');

  ligarSeletores(raiz, signal); // as listas dos campos do painel de detalhes

  const lista = iniciarLista(raiz, {
    signal,
    abrirDetalhe: (transacao) => detalhe.abrir(transacao),
    carregarMais: () => carregar(estado.pagina + 1, { acrescentar: true }),
    tentarNovamente: () => carregar(1),
    editarCampo: (transacao, campo, texto) => editarUmCampo(transacao, campo, texto),
    alterarVarias: (transacoes, mudancas) => alterarMarcadas(transacoes, mudancas),
    confirmarPendentes: (lote, inverso) => confirmarAlteracoes(lote, inverso),
    duplicarVarias: (transacoes) => duplicarMarcadas(transacoes),
    excluirVarias: (transacoes) => excluirMarcadas(transacoes),
  });

  detalhe = iniciarDetalhe(raiz, {
    signal,
    salvar: (id, alteracoes) => enviarLote(() => atualizarTransacoesEmLote([{ id, alteracoes }]), {
      sucesso: () => 'Transação alterada.',
      falha: 'Não foi possível salvar as alterações.',
    }),
    duplicar: (transacao) => enviarLote(() => duplicarTransacoes([transacao.id]), {
      sucesso: () => 'Transação duplicada com a data de hoje.',
      falha: 'Não foi possível duplicar a transação.',
    }),
    excluir: async (transacao) => {
      if (!(await confirmar(`Excluir "${transacao.descricao}"? Isso não pode ser desfeito.`, 'aviso'))) return false;
      lista.descartarRascunhoDe([transacao.id]);
      await enviarLote(() => excluirTransacoesEmLote([transacao.id]), {
        sucesso: () => 'Transação excluída.',
        falha: 'Não foi possível excluir a transação.',
      });
      return true;
    },
  });

  // Confere os campos digitados (descrição, valor...) como o formulário faz; devolve as alterações prontas ou null se algo é inválido.
  function conferir(mudancas) {
    const prontas = {};
    for (const [campo, texto] of Object.entries(mudancas)) {
      const { erro, valor } = validarCampo(campo, texto);
      if (erro) {
        notificar(erro, 'erro');
        return null;
      }
      prontas[campo] = valor;
    }
    return prontas;
  }

  // Editar um campo na linha, ou vários de uma vez na barra escura, só MARCA a alteração na tela (um rascunho, com a barra
  // "alterações pendentes"): nada vai para o Backend até o usuário confirmar. Devolve se a alteração era válida.
  async function editarUmCampo(transacao, campo, texto) {
    const alteracoes = conferir({ [campo]: texto });
    if (!alteracoes) return false;
    lista.rascunhar([transacao], alteracoes);
    return true;
  }

  async function alterarMarcadas(transacoes, mudancas) {
    const alteracoes = conferir(mudancas);
    if (!alteracoes) return false;
    lista.rascunhar(transacoes, alteracoes);
    return true;
  }

  // O botão Confirmar da barra de pendências: envia todas as alterações marcadas de uma vez (PATCH em lote) e recarrega.
  async function confirmarAlteracoes(lote, inverso) {
    try {
      await enviarLote(() => atualizarTransacoesEmLote(lote), {
        sucesso: (n) => (n === 1 ? 'Transação alterada.' : `${n} transações alteradas.`),
        falha: 'Não foi possível salvar as alterações.',
        desfazer: () => () => atualizarTransacoesEmLote(inverso.map((i) => ({ id: i.id, alteracoes: Object.fromEntries(Object.entries(i.alteracoes).filter(([, v]) => v !== undefined)) }))),
      });
      return true;
    } catch {
      return false; // as alterações continuam pendentes para tentar de novo
    }
  }

  async function duplicarMarcadas(transacoes) {
    const manuais = transacoes.filter((t) => t.origem !== 'pluggy');
    if (manuais.length < transacoes.length) notificar('Só lançamentos manuais podem ser duplicados; as importadas ficaram de fora.', 'info');
    if (manuais.length === 0) return;
    await enviarLote(() => duplicarTransacoes(manuais.map((t) => t.id)), {
      sucesso: (n) => (n === 1 ? 'Transação duplicada com a data de hoje.' : `${n} transações duplicadas com a data de hoje.`),
      falha: 'Não foi possível duplicar as transações.',
      // desfazer uma duplicação = excluir as cópias que acabaram de ser criadas
      desfazer: (resultado) => (resultado.copias?.length ? () => excluirTransacoesEmLote(resultado.copias.map((c) => c.id)) : null),
    }).catch(() => {});
    barra.sairDaSelecao();
  }

  async function excluirMarcadas(transacoes) {
    const texto = transacoes.length === 1 ? 'Excluir a transação selecionada?' : `Excluir as ${transacoes.length} transações selecionadas?`;
    if (!(await confirmar(`${texto} Isso não pode ser desfeito.`, 'aviso'))) return;
    lista.descartarRascunhoDe(transacoes.map((t) => t.id)); // o que estava pendente em transações excluídas some junto
    await enviarLote(() => excluirTransacoesEmLote(transacoes.map((t) => t.id)), {
      sucesso: (n) => (n === 1 ? 'Transação excluída.' : `${n} transações excluídas.`),
      falha: 'Não foi possível excluir as transações.',
    }).catch(() => {});
    barra.sairDaSelecao();
  }

  // As metas do usuário alimentam o filtro e o campo Meta. Sem elas a tela funciona igual, então uma falha aqui não bloqueia.
  async function carregarMetas() {
    try {
      const metas = await listarMetas();
      if (signal?.aborted) return;
      barra?.definirMetas(metas);
      detalhe.definirMetas(metas);
      lista.definirMetas(metas);
    } catch {
      // segue sem as metas
    }
  }

  // O botão "Desfazer" da notificação: roda a chamada contrária, avisa e recarrega a lista.
  async function desfazerAcao(inversa) {
    try {
      await inversa();
      notificar('Ação desfeita.', 'sucesso');
    } catch (erro) {
      notificar(erro?.status ? 'Não foi possível desfazer a ação.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
    }
    await carregar(1, { silencioso: true });
  }

  // Chama um endpoint em lote, avisa o resultado e recarrega a lista. O lote não é tudo ou nada: ids que não existem
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
    const inversa = textos.desfazer?.(resultado) ?? null; // a chamada que desfaz a ação, se ela pode ser desfeita
    if (naoEncontradas.length === 0) notificar(textos.sucesso(afetadas), 'sucesso', inversa ? { acao: { rotulo: 'Desfazer', aoClicar: () => desfazerAcao(inversa) } } : {});
    else if (afetadas === 0) notificar(`${textos.falha} As transações não foram encontradas (talvez já tenham sido excluídas).`, 'erro');
    else notificar(`${afetadas} concluídas e ${naoEncontradas.length} não encontradas (talvez já tenham sido excluídas).`, 'erro');

    await carregar(1, { silencioso: true }); // recarrega sem trocar a lista pelo esqueleto: a tela não pula
    return resultado;
  }

  async function carregar(pagina, { acrescentar = false, silencioso = false } = {}) {
    const minha = ++estado.sequencia; // ignora respostas antigas se o usuário mudar o mês ou os filtros rápido
    estado.pagina = pagina;
    if (!silencioso) lista.iniciarCarga({ acrescentar });

    try {
      const resposta = await listarTransacoes({ ...estado.parametros, pagina, limite: POR_PAGINA });
      if (minha !== estado.sequencia) return;
      lista.mostrarResposta(resposta, {
        acrescentar,
        mensagemVazia: temFiltros() ? 'Nenhuma transação encontrada com esses filtros neste período.' : 'Nenhuma transação neste período.',
      });
    } catch (erro) {
      if (minha !== estado.sequencia) return;
      lista.mostrarErro(erro);
    }
  }

  const formulario = iniciarFormulario(raiz, {
    signal,
    aoSalvar: async () => {
      if (temFiltros()) notificar('Se a transação não aparecer na lista, confira os filtros e o mês.', 'info');
      carregarMetas(); // o formulário pode ter criado uma meta nova
      await carregar(1);
    },
  });

  carregarMetas();

  // A barra já nasce no mês atual, sem filtros, e chama aoMudar assim que é ligada: é a primeira consulta da tela.
  barra = iniciarBarra(raiz, {
    signal,
    aoMudar: (parametros) => {
      estado.parametros = parametros;
      carregar(1);
    },
    aoSelecionar: (ativo) => lista.definirSelecao(ativo),
    aoNovo: (tipo) => formulario.abrir(tipo),
  });

  // Recarregar ou fechar a página com alterações não confirmadas pede confirmação ao navegador. A troca de tela dentro do SPA é
  // tratada pelo roteador (app/main.js), que pergunta usando temPendencias().
  window.addEventListener('beforeunload', (evento) => {
    if (!lista.temPendencias()) return;
    evento.preventDefault();
    evento.returnValue = '';
  }, { signal });

  return { temPendencias: () => lista.temPendencias() };
}
