/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import {
  atualizarCartao,
  criarCartao,
  excluirCartao,
  listarCartoes,
} from '../../services/investmentsService.js';
import { notificar, confirmar, comCarregamento } from '../../../../shared/components/notificacao.js';
import { ligarSeletores } from '../../../../shared/components/seletor.js';
import { desfazerExclusao, listarMinhasContas } from '../../../contas-conectadas/services/contasService.js';
import { mensagemDeErro } from '../../utils/constants.js';
import { iniciarCartoes } from '../CartoesLista/CartoesLista.js';
import { iniciarCartaoForm } from '../CartaoForm/CartaoForm.js';
import { iniciarCompras } from '../CartaoCompras/CartaoCompras.js';
import { iniciarPaginaTransacoes } from '../../../transactions/components/TransactionsPage/TransactionsPage.js';

/**
 * Liga a página do Cartão de crédito ao HTML de views/investments.html (já dentro do container): uma fila horizontal de cartões, o
 * cartão escolhido em destaque (fatura, limite, editar e excluir), o formulário de cartão e, em Ver fatura, as compras do cartão escolhido.
 * Ter cartão é opcional: sem nenhum, a tela só oferece criar o primeiro (que precisa de uma conta).
 * Os parcelamentos nascem das compras parceladas feitas em Transações (campo Parcelas). A estrutura da tela está toda no
 * HTML; aqui ficam só as partes que mudam com os dados. `signal` (de um AbortController) avisa que a tela foi desmontada.
 */
export function iniciarPaginaCartao(raiz, { signal } = {}) {
  const estado = { sequencia: 0, cartaoId: null, contas: null }; // cartaoId: o cartão escolhido (null = o primeiro)
  ligarSeletores(raiz, signal); // a lista do campo Conta do formulário de cartão

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const carregando = raiz.querySelector('#investments-carregando');
  const erro = raiz.querySelector('#investments-erro');
  const erroTexto = raiz.querySelector('#investments-erro-texto');
  const conteudo = raiz.querySelector('#investments-conteudo');

  const formulario = iniciarCartaoForm(raiz, {
    signal,
    salvar: (dados, modo, atual) => (modo === 'novo'
      ? agir(() => criarCartao(dados), 'Cartão criado.', 'Não foi possível criar o cartão.', (criado) => { estado.cartaoId = criado.id; })
      : agir(() => atualizarCartao(atual.id, dados), 'Cartão atualizado.', 'Não foi possível atualizar o cartão.')),
  });
  // aoMudarMes: a lista de lançamentos do cartão busca o período da fatura que o usuário escolheu
  const compras = iniciarCompras(raiz, { signal, aoMudarMes: () => lancamentos?.recarregar() });
  const cartoes = iniciarCartoes(raiz, {
    signal,
    selecionar: (cartao) => {
      if (cartao.id === estado.cartaoId) return;
      estado.cartaoId = cartao.id;
      mostrarEscolhido();
    },
    novo: () => abrirNovoCartao(),
    editar: (cartao) => formulario.abrirEditar(cartao),
    excluir: async (cartao) => {
      if (!(await confirmar(`Excluir "${cartao.nome}" com seus lançamentos e parcelamentos?`, 'aviso'))) return;
      await agir(
        () => excluirCartao(cartao.id), `Cartão "${cartao.nome}" excluído.`, 'Não foi possível excluir o cartão.', undefined, 'Excluindo o cartão...',
        (saida) => ({ duracao: 8000, acao: { rotulo: 'Desfazer', aoClicar: () => desfazer(saida.desfazerId) } }),
      ).catch(() => {});
    },
  });

  /** As contas do usuário: o cartão é vinculado a uma. Sem nenhuma, leva o usuário a criar uma conta antes. */
  async function carregarContas() {
    try {
      estado.contas = await listarMinhasContas();
      if (!signal?.aborted) formulario.definirContas(estado.contas);
    } catch {
      estado.contas = null;
    }
  }

  async function abrirNovoCartao() {
    if (estado.contas === null) await carregarContas();
    if (estado.contas?.length === 0) {
      if (await confirmar('Todo cartão precisa de uma conta. Criar uma agora?', 'aviso')) window.location.hash = '#contas-conectadas';
      return;
    }
    formulario.abrirNovo();
  }

  let lista = []; // os cartões carregados
  let lancamentos = null; // as peças das Transações (barra, lista, formulário e detalhes) escopadas ao cartão escolhido
  let listadoDe = null; // o cartão cujos lançamentos a lista mostra (muda a escolha: busca de novo)

  raiz.querySelector('#investments-tentar-novamente').addEventListener('click', () => carregar(), { signal });

  /** Marca o card escolhido e mostra a fatura dele logo abaixo (sem cartão, não há fatura). */
  function mostrarEscolhido() {
    cartoes.mostrar(lista, estado.cartaoId);
    const escolhido = lista.find((c) => c.id === estado.cartaoId);
    if (escolhido) compras.mostrar(escolhido);
    else compras.esconder();
    // cartão do Open Finance não aceita lançamento manual: o botão Lançamento some
    const botaoNovo = raiz.querySelector('#barra-novo-area');
    if (botaoNovo) botaoNovo.hidden = Boolean(escolhido?.openFinance);
    if ((escolhido?.id ?? null) !== listadoDe) {
      listadoDe = escolhido?.id ?? null;
      if (listadoDe) lancamentos?.recarregar();
    }
  }

  /** Busca os cartões. `silencioso` atualiza sem trocar a tela por "Carregando..." (depois de uma ação). */
  async function carregar({ silencioso = false } = {}) {
    const minha = ++estado.sequencia; // ignora respostas antigas
    if (!silencioso) {
      carregando.hidden = false;
      erro.hidden = true;
      conteudo.hidden = true;
    }

    try {
      const resposta = await listarCartoes();
      if (minha !== estado.sequencia) return;
      lista = resposta.cartoes;
      if (!lista.some((c) => c.id === estado.cartaoId)) estado.cartaoId = lista[0]?.id ?? null; // o escolhido sumiu: volta ao primeiro (ou a nenhum)

      mostrarEscolhido();
      carregando.hidden = true;
      erro.hidden = true;
      conteudo.hidden = false;
    } catch (falha) {
      if (minha !== estado.sequencia) return;
      const mensagem = mensagemDeErro(falha, 'Não foi possível carregar os cartões.');
      if (silencioso && !conteudo.hidden) {
        notificar(mensagem, 'erro'); // a tela já tem dados: só avisa, sem apagá-la
        return;
      }
      carregando.hidden = true;
      conteudo.hidden = true;
      erro.hidden = false;
      erroTexto.textContent = mensagem;
    }
  }

  // Faz uma chamada, avisa o resultado e atualiza a tela. Se a chamada falhar, avisa e devolve o erro (o formulário
  // continua aberto e mostra os erros de campo).
  async function agir(chamada, sucesso, falha, aoConcluir, carregandoTexto = 'Salvando o cartão...', opcoesDoAviso) {
    let resultado;
    try {
      resultado = await comCarregamento(carregandoTexto, chamada);
    } catch (falhou) {
      notificar(mensagemDeErro(falhou, falha), 'erro');
      throw falhou;
    }
    aoConcluir?.(resultado); // por exemplo, passar a mostrar o cartão que acabou de ser criado
    notificar(sucesso, 'sucesso', opcoesDoAviso?.(resultado));
    await carregar({ silencioso: true });
  }

  async function desfazer(desfazerId) {
    try {
      await desfazerExclusao(desfazerId);
      notificar('Exclusão desfeita.', 'sucesso');
      await carregar({ silencioso: true });
    } catch (falhou) {
      notificar(mensagemDeErro(falhou, 'Não foi possível desfazer a exclusão.'), 'erro');
    }
  }

  // Os lançamentos do cartão escolhido, no mês da fatura: as mesmas peças da tela de Transações (filtros, edição, seleção, desfazer), escopadas ao cartão.
  // Depois de criar, editar ou excluir um lançamento a fatura e o limite mudam: os cartões são carregados de novo.
  lancamentos = iniciarPaginaTransacoes(raiz, {
    signal,
    escopo: {
      cartao: () => lista.find((c) => c.id === estado.cartaoId) ?? null,
      periodo: () => compras.periodo(),
      aoAlterar: () => carregar({ silencioso: true }),
    },
  });

  carregarContas();
  carregar();
  return { temPendencias: () => lancamentos.temPendencias() };
}
