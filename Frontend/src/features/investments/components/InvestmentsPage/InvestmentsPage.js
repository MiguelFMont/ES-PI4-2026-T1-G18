import {
  atualizarCartao,
  atualizarParcelamento,
  criarParcelamento,
  excluirParcelamento,
  listarParcelamentos,
  obterCartao,
} from '../../services/investmentsService.js';
import { notificar, confirmar } from '../../../../shared/components/notificacao.js';
import { mensagemDeErro } from '../../utils/constants.js';
import { iniciarCartao } from '../CardResumo/CardResumo.js';
import { iniciarParcelamentos } from '../CardInstallments/CardInstallments.js';

/**
 * Liga a página do Cartão de crédito ao HTML de views/investments.html (já dentro do container): o cartão (fatura e
 * limite) e os parcelamentos. A estrutura da tela está toda no HTML; aqui ficam só as partes que mudam com os
 * dados. `signal` (de um AbortController) avisa que a tela foi desmontada.
 */
export function iniciarPaginaCartao(raiz, { signal } = {}) {
  const estado = { sequencia: 0 };

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const carregando = raiz.querySelector('#investments-carregando');
  const erro = raiz.querySelector('#investments-erro');
  const erroTexto = raiz.querySelector('#investments-erro-texto');
  const conteudo = raiz.querySelector('#investments-conteudo');

  const cartao = iniciarCartao(raiz, {
    signal,
    salvar: (alteracoes) => agir(() => atualizarCartao(alteracoes), 'Cartão atualizado.', 'Não foi possível atualizar o cartão.'),
  });
  const parcelamentos = iniciarParcelamentos(raiz, {
    signal,
    criar: (dados) => agir(() => criarParcelamento(dados), 'Parcelamento adicionado.', 'Não foi possível adicionar o parcelamento.'),
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
      const [dadosDoCartao, dadosDosParcelamentos] = await Promise.all([obterCartao(), listarParcelamentos()]);
      if (minha !== estado.sequencia) return;

      cartao.atualizar(dadosDoCartao);
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

  // Faz uma chamada, avisa o resultado e atualiza a tela. Se a chamada falhar, avisa e devolve o erro (o formulário
  // continua aberto e mostra os erros de campo).
  async function agir(chamada, sucesso, falha) {
    try {
      await chamada();
    } catch (falhou) {
      notificar(mensagemDeErro(falhou, falha), 'erro');
      throw falhou;
    }
    notificar(sucesso, 'sucesso');
    await carregar({ silencioso: true });
  }

  carregar();
}
