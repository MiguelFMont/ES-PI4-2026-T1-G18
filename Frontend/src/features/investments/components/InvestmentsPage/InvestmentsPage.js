import {
  atualizarCartao,
  atualizarParcelamento,
  criarCartao,
  criarParcelamento,
  excluirCartao,
  excluirParcelamento,
  listarCartoes,
  listarParcelamentos,
} from '../../services/investmentsService.js';
import { notificar, confirmar } from '../../../../shared/components/notificacao.js';
import { mensagemDeErro } from '../../utils/constants.js';
import { iniciarCartoes } from '../CartoesSeletor/CartoesSeletor.js';
import { iniciarCartao } from '../CardResumo/CardResumo.js';
import { iniciarParcelamentos } from '../CardInstallments/CardInstallments.js';

/**
 * Liga a página do Cartão de crédito ao HTML de views/investments.html (já dentro do container): o seletor dos cartões do
 * usuário, o cartão escolhido (fatura e limite) e os parcelamentos dele. A estrutura da tela está toda no HTML; aqui ficam só as partes que mudam com os
 * dados. `signal` (de um AbortController) avisa que a tela foi desmontada.
 */
export function iniciarPaginaCartao(raiz, { signal } = {}) {
  const estado = { sequencia: 0, cartaoId: null, cartoes: [] }; // cartaoId: o cartão escolhido (null = o primeiro)

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const carregando = raiz.querySelector('#investments-carregando');
  const erro = raiz.querySelector('#investments-erro');
  const erroTexto = raiz.querySelector('#investments-erro-texto');
  const conteudo = raiz.querySelector('#investments-conteudo');

  const seletor = iniciarCartoes(raiz, {
    signal,
    selecionar: (id) => escolher(id),
    novo: () => cartao.abrirNovo(),
  });
  const cartao = iniciarCartao(raiz, {
    signal,
    salvar: (dados, modo) => (modo === 'novo'
      ? agir(() => criarCartao(dados), 'Cartão criado.', 'Não foi possível criar o cartão.', (criado) => { estado.cartaoId = criado.id; })
      : agir(() => atualizarCartao(estado.cartaoId, dados), 'Cartão atualizado.', 'Não foi possível atualizar o cartão.')),
    excluir: async (atual) => {
      if (!(await confirmar(`Excluir o cartão "${atual.nome}"? As compras dele continuam em Transações, sem o vínculo com o cartão.`, 'aviso'))) return;
      await agir(() => excluirCartao(atual.id), 'Cartão excluído.', 'Não foi possível excluir o cartão.', () => { estado.cartaoId = null; }).catch(() => {});
    },
  });
  const parcelamentos = iniciarParcelamentos(raiz, {
    signal,
    criar: (dados) => agir(() => criarParcelamento({ ...dados, cartaoId: estado.cartaoId }), 'Parcelamento adicionado.', 'Não foi possível adicionar o parcelamento.'),
    pagar: (p) =>
      agir(() => atualizarParcelamento(p.id, { parcelasPagas: p.parcelasPagas + 1 }), 'Parcela paga.', 'Não foi possível registrar o pagamento.')
        .catch(() => {}),
    excluir: async (p) => {
      if (!(await confirmar(`Excluir o parcelamento "${p.descricao}"?`, 'aviso'))) return;
      await agir(() => excluirParcelamento(p.id), 'Parcelamento excluído.', 'Não foi possível excluir o parcelamento.').catch(() => {});
    },
  });

  raiz.querySelector('#investments-tentar-novamente').addEventListener('click', () => carregar(), { signal });

  /** Busca tudo de uma vez. `silencioso` atualiza sem trocar a tela por "Carregando..." (depois de uma ação). */
  async function carregar({ silencioso = false } = {}) {
    const minha = ++estado.sequencia; // ignora respostas antigas
    if (!silencioso) {
      carregando.hidden = false;
      erro.hidden = true;
      conteudo.hidden = true;
    }

    try {
      const { cartoes } = await listarCartoes();
      if (minha !== estado.sequencia) return;
      estado.cartoes = cartoes;
      if (!cartoes.some((c) => c.id === estado.cartaoId)) estado.cartaoId = cartoes[0].id; // o escolhido sumiu: volta ao padrão

      const dadosDosParcelamentos = await listarParcelamentos(estado.cartaoId);
      if (minha !== estado.sequencia) return;

      mostrarCartao();
      parcelamentos.mostrar(dadosDosParcelamentos);

      carregando.hidden = true;
      erro.hidden = true;
      conteudo.hidden = false;
    } catch (falha) {
      if (minha !== estado.sequencia) return;
      const mensagem = mensagemDeErro(falha, 'Não foi possível carregar o cartão.');
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

  /** Mostra o cartão escolhido (e marca o botão dele) com o que já foi carregado. */
  function mostrarCartao() {
    const escolhido = estado.cartoes.find((c) => c.id === estado.cartaoId);
    seletor.mostrar(estado.cartoes, estado.cartaoId);
    cartao.atualizar(escolhido);
  }

  /** Troca o cartão escolhido: mostra o cartão na hora e busca os parcelamentos dele. */
  async function escolher(id) {
    if (id === estado.cartaoId || !estado.cartoes.some((c) => c.id === id)) return;
    estado.cartaoId = id;
    mostrarCartao();
    const minha = ++estado.sequencia; // uma resposta de outro cartão que ainda esteja a caminho deixa de valer
    try {
      const resposta = await listarParcelamentos(id);
      if (minha === estado.sequencia) parcelamentos.mostrar(resposta);
    } catch (falha) {
      if (minha === estado.sequencia) notificar(mensagemDeErro(falha, 'Não foi possível carregar os parcelamentos.'), 'erro');
    }
  }

  // Faz uma chamada, avisa o resultado e atualiza a tela. Se a chamada falhar, avisa e devolve o erro (o formulário
  // continua aberto e mostra os erros de campo).
  async function agir(chamada, sucesso, falha, aoConcluir) {
    let resultado;
    try {
      resultado = await chamada();
    } catch (falhou) {
      notificar(mensagemDeErro(falhou, falha), 'erro');
      throw falhou;
    }
    aoConcluir?.(resultado); // por exemplo, passar a mostrar o cartão que acabou de ser criado
    notificar(sucesso, 'sucesso');
    await carregar({ silencioso: true });
  }

  carregar();
}
