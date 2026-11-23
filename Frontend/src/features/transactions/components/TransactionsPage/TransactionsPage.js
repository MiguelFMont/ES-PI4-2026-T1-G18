/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import { atualizarTransacoesEmLote, duplicarTransacoes, excluirTransacoesEmLote, listarTransacoes } from '../../services/transactionsService.js';
import { desfazerExclusao } from '../../../contas-conectadas/services/contasService.js';
import { notificar, confirmar, comCarregamento } from '../../../../shared/components/notificacao.js';
import { listarMetas } from '../../../goals/services/goalsService.js';
import { listarMinhasContas } from '../../../contas-conectadas/services/contasService.js';
import { listarCartoes } from '../../../investments/services/investmentsService.js';
import { ligarSeletores } from '../../../../shared/components/seletor.js';
import { iniciarFormulario } from '../TransactionForm/TransactionForm.js';
import { iniciarBarra } from '../TransactionBarra/TransactionBarra.js';
import { iniciarLista } from '../TransactionLista/TransactionLista.js';
import { iniciarDetalhe } from '../TransactionDetalhe/TransactionDetalhe.js';
import { iniciarCartaoRapido } from '../TransactionCartao/TransactionCartao.js';
import { validarCampo } from '../../utils/formValidation.js';

const POR_PAGINA_PADRAO = 50; // o "Por página" do rodapé da lista escolhe entre 20, 50, 100 e Tudo (0: sem paginar, todos=true na API); "Carregar mais" pede a página seguinte

/**
 * Liga a lógica da página de Transações ao HTML de views/transactions.html (já dentro do container): a barra do topo (mês,
 * filtros e busca), a lista do mês agrupada por dia, o painel de detalhes (editar, duplicar e excluir uma transação) e o
 * formulário de nova transação. A estrutura da tela está toda no HTML; aqui ficam só as partes que mudam com os dados.
 * `signal` (de um AbortController) avisa que a tela foi desmontada.
 * `escopo` (opcional) leva as mesmas peças para a aba Cartão: só as transações de um cartão, no período da fatura. É { cartao() (o cartão
 * escolhido, ou null), periodo() ({ dataInicio, dataFim } da fatura), aoAlterar() (depois de criar, editar, excluir ou desfazer: a fatura e o
 * limite mudam) }. Nesse modo não há transferência, nem filtro de data, de pagamento ou de conta, e o lançamento já nasce no cartão.
 * Devolve { temPendencias(), recarregar() }.
 */
export function iniciarPaginaTransacoes(raiz, { signal, escopo } = {}) {
  let barra; // ligados mais abaixo; as metas podem chegar antes ou depois
  let detalhe;
  const estado = { parametros: {}, pagina: 1, sequencia: 0, limite: POR_PAGINA_PADRAO, contas: null }; // contas: null até chegarem (ou se a busca falhar)

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const temFiltros = () => Object.keys(estado.parametros).some((chave) => chave !== 'dataInicio' && chave !== 'dataFim');

  if (escopo) raiz.dataset.escopoCartao = ''; // o CSS esconde, no formulário, a conta, o pagamento e o cartão (já são os do cartão)
  else ligarSeletores(raiz, signal); // as listas dos campos do painel de detalhes (na aba Cartão, quem liga é a própria tela)

  const lista = iniciarLista(raiz, {
    signal,
    abrirDetalhe: (transacao) => detalhe.abrir(transacao),
    irParaPagina: (numero) => {
      carregar(numero);
      raiz.querySelector('#lista-cabecalho')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); // volta ao topo do extrato
    },
    mudarLimite: (quantidade) => {
      estado.limite = quantidade;
      carregar(1);
    },
    tentarNovamente: () => carregar(1),
    editarCampo: (transacao, campo, texto) => editarUmCampo(transacao, campo, texto),
    alterarVarias: (transacoes, mudancas) => alterarMarcadas(transacoes, mudancas),
    confirmarPendentes: (lote, inverso) => confirmarAlteracoes(lote, inverso),
    duplicarVarias: (transacoes) => duplicarMarcadas(transacoes),
    excluirVarias: (transacoes) => excluirMarcadas(transacoes),
  });

  // Quem abriu a janela "Novo cartão": o formulário de lançamento ou o painel de detalhes (ele recebe o cartão criado)
  let destinoDoCartao = 'formulario';

  detalhe = iniciarDetalhe(raiz, {
    signal,
    abrirCartaoRapido: (dados) => {
      destinoDoCartao = 'detalhe';
      cartaoRapido.abrir(dados);
    },
    salvar: (id, alteracoes, original) => enviarLote(() => atualizarTransacoesEmLote([{ id, alteracoes }]), {
      sucesso: () => 'Transação alterada.',
      carregando: 'Salvando as alterações...',
      falha: 'Não foi possível salvar as alterações.',
      // desfazer = voltar os campos que mudaram para os valores de antes
      desfazer: () => (original ? () => atualizarTransacoesEmLote([{ id, alteracoes: valoresDeAntes(original, alteracoes) }]) : null),
    }),
    duplicar: (transacao) => enviarLote(() => duplicarTransacoes([transacao.id]), {
      sucesso: () => 'Transação duplicada com a data de hoje.',
      carregando: 'Duplicando...',
      falha: 'Não foi possível duplicar a transação.',
      desfazer: desfazerDuplicacao,
    }),
    excluir: async (transacao) => {
      if (bloqueadaPeloOpenFinance([transacao])) return false;
      if (!(await confirmar(`Excluir "${transacao.descricao}"?`, 'aviso'))) return false;
      lista.descartarRascunhoDe([transacao.id]);
      await enviarLote(() => excluirTransacoesEmLote([transacao.id]), {
        sucesso: () => 'Transação excluída.',
        carregando: 'Excluindo...',
        falha: 'Não foi possível excluir a transação.',
        desfazer: desfazerExclusaoDeLancamentos,
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
    // uma transferência só tem descrição e valor (e data e observação, nos detalhes): sem categoria, pagamento, meta ou tipo
    const soDescricaoEValor = Object.keys(alteracoes).every((campo) => campo === 'descricao' || campo === 'valor');
    const semTransferencias = soDescricaoEValor ? transacoes : transacoes.filter((t) => t.tipo !== 'transferencia');
    // o que vem do Open Finance só aceita descrição, categoria e meta
    const aceitaOpenFinance = Object.keys(alteracoes).every((campo) => ['descricao', 'categoria', 'metaId', 'observacoes'].includes(campo));
    const alvo = semTransferencias.filter((t) => t.origem !== 'pluggy' || aceitaOpenFinance);
    if (semTransferencias.length < transacoes.length) notificar('Transferências não têm categoria, pagamento nem meta.', 'info');
    if (alvo.length < semTransferencias.length) {
      notificar('Open Finance só permite mudar descrição, categoria, meta e observação.', 'info');
    }
    if (alvo.length === 0) return false;
    lista.rascunhar(alvo, alteracoes);
    return true;
  }

  // O botão Confirmar da barra de pendências: envia todas as alterações marcadas de uma vez (PATCH em lote) e recarrega.
  async function confirmarAlteracoes(lote, inverso) {
    try {
      await enviarLote(() => atualizarTransacoesEmLote(lote), {
        sucesso: (n) => (n === 1 ? 'Transação alterada.' : `${n} transações alteradas.`),
        carregando: 'Salvando as alterações...',
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
    if (manuais.length < transacoes.length) notificar('Só lançamentos manuais podem ser duplicados.', 'info');
    if (manuais.length === 0) return;
    await enviarLote(() => duplicarTransacoes(manuais.map((t) => t.id)), {
      sucesso: (n) => (n === 1 ? 'Transação duplicada com a data de hoje.' : `${n} transações duplicadas com a data de hoje.`),
      carregando: 'Duplicando...',
      falha: 'Não foi possível duplicar as transações.',
      desfazer: desfazerDuplicacao,
    }).catch(() => {});
    barra.sairDaSelecao();
  }

  // Os desfazeres (o botão "Desfazer" da notificação): cada um devolve a chamada contrária, ou null se não há o que desfazer.
  // duplicação = excluir as cópias que acabaram de ser criadas; exclusão = o Backend guarda o que saiu por 2 minutos (POST /undo/:id).
  const desfazerDuplicacao = (resultado) => (resultado.copias?.length ? () => excluirTransacoesEmLote(resultado.copias.map((c) => c.id)) : null);
  const desfazerExclusaoDeLancamentos = (resultado) => (resultado.desfazerIds?.length ? () => Promise.all(resultado.desfazerIds.map((id) => desfazerExclusao(id))) : null);
  const valoresDeAntes = (original, alteracoes) => Object.fromEntries(Object.keys(alteracoes).map((nome) => [
    nome,
    nome === 'metaId' || nome === 'cartaoId' ? (original[nome] ?? null) : nome === 'data' ? original.data.slice(0, 10) : nome === 'observacoes' ? (original[nome] ?? '') : original[nome],
  ]));

  // Lançamento de conta com conexão Open Finance não se exclui (o Backend também recusa): desconectando a conta, ela vira manual e libera.
  function bloqueadaPeloOpenFinance(transacoes) {
    const abertas = new Set((estado.contas ?? []).filter((c) => c.tipo === 'open_finance').map((c) => c.id));
    if (!transacoes.some((t) => abertas.has(t.contaId) || abertas.has(t.contaDestinoId))) return false;
    notificar('Lançamentos do Open Finance não podem ser excluídos. Desconecte a conta.', 'aviso');
    return true;
  }

  async function excluirMarcadas(transacoes) {
    if (bloqueadaPeloOpenFinance(transacoes)) return;
    const texto = transacoes.length === 1 ? 'Excluir a transação selecionada?' : `Excluir as ${transacoes.length} transações selecionadas?`;
    if (!(await confirmar(texto, 'aviso'))) return;
    lista.descartarRascunhoDe(transacoes.map((t) => t.id)); // o que estava pendente em transações excluídas some junto
    await enviarLote(() => excluirTransacoesEmLote(transacoes.map((t) => t.id)), {
      sucesso: (n) => (n === 1 ? 'Transação excluída.' : `${n} transações excluídas.`),
      carregando: 'Excluindo...',
      falha: 'Não foi possível excluir as transações.',
      desfazer: desfazerExclusaoDeLancamentos,
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

  // As contas do usuário alimentam o campo Conta, o filtro Origem e a janela de transferência. Sem elas a tela continua abrindo
  // (o Backend confere a conta de qualquer jeito), então uma falha aqui não bloqueia.
  async function carregarContas() {
    try {
      const contas = await listarMinhasContas();
      if (signal?.aborted) return;
      estado.contas = contas;
      lista.definirContas(contas);
      barra?.definirContas(contas);
      detalhe.definirContas(contas);
      formulario.definirContas(contas);
    } catch {
      // segue sem as contas
    }
  }

  // Os cartões do usuário alimentam o submenu do filtro Pagamento > Cartão de crédito. Sem eles o filtro funciona igual.
  async function carregarCartoes() {
    try {
      const { cartoes } = await listarCartoes();
      if (signal?.aborted) return;
      barra?.definirCartoes(cartoes);
      lista.definirCartoes(cartoes);
      detalhe.definirCartoes(cartoes);
    } catch {
      // segue sem o submenu de cartões
    }
  }

  const irParaContas = () => { window.location.hash = '#contas-conectadas'; };

  // Novo lançamento ou nova transferência. Sem nenhuma conta o usuário é levado a criar uma (RN4); a transferência pede ao menos
  // duas contas manuais (RN7).
  async function novoLancamento(tipo) {
    if (escopo) {
      const cartao = escopo.cartao();
      if (!cartao || tipo === 'transferencia') return;
      if (cartao.openFinance) {
        notificar('Cartão do Open Finance não aceita lançamento manual.', 'aviso');
        return;
      }
      if (estado.contas === null) await carregarContas();
      formulario.abrirNoCartao(tipo, cartao);
      return;
    }
    if (estado.contas === null) await carregarContas(); // a primeira busca falhou: tenta de novo
    // lançamento manual só em conta manual (a conta Open Finance recebe só o que vem do banco)
    if (estado.contas && estado.contas.every((c) => c.tipo !== 'manual')) {
      const texto = estado.contas.length === 0
        ? 'Você não tem nenhuma conta.'
        : 'Contas Open Finance não aceitam lançamento manual.';
      if (await confirmar(`${texto} Criar uma conta manual agora?`, 'aviso')) irParaContas();
      return;
    }
    if (tipo === 'transferencia') {
      const manuais = (estado.contas ?? []).filter((c) => c.tipo === 'manual');
      if (manuais.length < 2) {
        if (await confirmar('Transferir exige duas contas manuais. Criar outra agora?', 'aviso')) irParaContas();
        return;
      }
    }
    formulario.abrir(tipo); // 'transferencia' abre o mesmo formulário, já na aba Transferência
  }

  // O botão "Desfazer" da notificação: roda a chamada contrária, avisa e recarrega a lista.
  async function desfazerAcao(inversa) {
    try {
      await inversa();
      notificar('Ação desfeita.', 'sucesso');
    } catch (erro) {
      notificar(erro?.status ? 'Não foi possível desfazer a ação.' : (erro?.message ?? 'Erro inesperado.'), 'erro');
    }
    await carregar(estado.pagina, { silencioso: true });
    escopo?.aoAlterar();
  }

  // Chama um endpoint em lote, avisa o resultado e recarrega a lista. O lote não é tudo ou nada: ids que não existem
  // mais voltam em `naoEncontradas` e contam como falha parcial. Se a chamada falhar, o erro segue para quem chamou.
  async function enviarLote(chamada, textos) {
    let resultado;
    try {
      resultado = await comCarregamento(textos.carregando ?? 'Salvando...', chamada);
    } catch (erro) {
      notificar(erro?.status ? textos.falha : (erro?.message ?? 'Erro inesperado.'), 'erro');
      throw erro;
    }

    const { afetadas, naoEncontradas } = resultado;
    const inversa = textos.desfazer?.(resultado) ?? null; // a chamada que desfaz a ação, se ela pode ser desfeita
    if (naoEncontradas.length === 0) notificar(textos.sucesso(afetadas), 'sucesso', inversa ? { acao: { rotulo: 'Desfazer', aoClicar: () => desfazerAcao(inversa) } } : {});
    else if (afetadas === 0) notificar(`${textos.falha} Já foram excluídas?`, 'erro');
    else notificar(`${afetadas} concluídas, ${naoEncontradas.length} não encontradas.`, 'erro');

    await carregar(estado.pagina, { silencioso: true }); // recarrega sem trocar a lista pelo esqueleto: a tela não pula
    escopo?.aoAlterar();
    return resultado;
  }

  async function carregar(pagina, { silencioso = false } = {}) {
    const cartao = escopo?.cartao();
    if (escopo && !cartao) return; // a aba Cartão ainda não tem cartão escolhido
    const minha = ++estado.sequencia; // ignora respostas antigas se o usuário mudar o mês ou os filtros rápido
    estado.pagina = pagina;
    if (!silencioso) lista.iniciarCarga();

    try {
      const doEscopo = escopo ? { cartaoId: cartao.id, ...escopo.periodo() } : {}; // só deste cartão, no período da fatura
      const resposta = await listarTransacoes({ ...estado.parametros, ...doEscopo, ...(estado.limite === 0 ? { todos: true } : { pagina, limite: estado.limite }) });
      if (minha !== estado.sequencia) return;
      // a página pedida deixou de existir (as últimas transações foram excluídas ou o filtro mudou): volta à última
      if (resposta.itens.length === 0 && pagina > 1 && resposta.totalPaginas > 0) {
        carregar(resposta.totalPaginas, { silencioso });
        return;
      }
      lista.mostrarResposta(resposta, {
        mensagemVazia: temFiltros() ? 'Nenhuma transação encontrada com esses filtros neste período.' : 'Nenhuma transação neste período.',
      });
    } catch (erro) {
      if (minha !== estado.sequencia) return;
      lista.mostrarErro(erro);
    }
  }

  const formulario = iniciarFormulario(raiz, {
    signal,
    aoAbrirPeloBotao: () => novoLancamento(),
    recarregarContas: () => carregarContas(),
    abrirCartaoRapido: (dados) => {
      destinoDoCartao = 'formulario';
      cartaoRapido.abrir(dados);
    },
    aoSalvar: async () => {
      if (temFiltros()) notificar('Se o lançamento não aparecer na lista, confira os filtros e o mês.', 'info');
      carregarMetas(); // o formulário pode ter criado uma meta nova
      await carregar(1);
      escopo?.aoAlterar();
    },
  });

  // A janela "Novo cartão" (aberta pelo botão do campo Cartão, quando a conta escolhida não tem cartão): ao criar, o lançamento escolhe o cartão novo
  // e as listas de cartões da tela são atualizadas.
  const cartaoRapido = iniciarCartaoRapido(raiz, {
    signal,
    aoCriar: async (cartao) => {
      if (destinoDoCartao === 'detalhe') {
        await carregarCartoes(); // a lista do painel já traz o cartão novo
        detalhe.cartaoCriado(cartao);
      } else {
        await formulario.cartaoCriado(cartao);
        carregarCartoes();
      }
    },
  });

  carregarMetas();
  carregarContas();
  carregarCartoes();

  // A barra já nasce no mês atual, sem filtros, e chama aoMudar assim que é ligada: é a primeira consulta da tela.
  barra = iniciarBarra(raiz, {
    signal,
    aoMudar: (parametros) => {
      estado.parametros = parametros;
      carregar(1);
    },
    aoSelecionar: (ativo) => lista.definirSelecao(ativo),
    aoNovo: (tipo) => novoLancamento(tipo),
    escopoDoCartao: Boolean(escopo),
  });

  // Recarregar ou fechar a página com alterações não confirmadas pede confirmação ao navegador. A troca de tela dentro do SPA é
  // tratada pelo roteador (app/main.js), que pergunta usando temPendencias().
  window.addEventListener('beforeunload', (evento) => {
    if (!lista.temPendencias()) return;
    evento.preventDefault();
    evento.returnValue = '';
  }, { signal });

  return { temPendencias: () => lista.temPendencias(), recarregar: () => carregar(1) };
}
