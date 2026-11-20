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
import { ligarSeletores } from '../../../../shared/components/seletor.js';
import { mensagemDeErro } from '../../utils/constants.js';
import { iniciarCartoes } from '../CartoesLista/CartoesLista.js';
import { iniciarCartaoForm } from '../CartaoForm/CartaoForm.js';
import { iniciarParcelamentos } from '../CardInstallments/CardInstallments.js';

/**
 * Liga a página do Cartão de crédito ao HTML de views/investments.html (já dentro do container): um card para cada cartão
 * do usuário (fatura, limite e totais), o formulário de cartão e os parcelamentos de todos os cartões. A estrutura da tela
 * está toda no HTML; aqui ficam só as partes que mudam com os dados. `signal` (de um AbortController) avisa que a tela foi
 * desmontada.
 */
export function iniciarPaginaCartao(raiz, { signal } = {}) {
  const estado = { sequencia: 0 };

  // Ao desmontar a tela, uma resposta que ainda esteja a caminho deixa de valer.
  signal?.addEventListener('abort', () => { estado.sequencia += 1; });

  const carregando = raiz.querySelector('#investments-carregando');
  const erro = raiz.querySelector('#investments-erro');
  const erroTexto = raiz.querySelector('#investments-erro-texto');
  const conteudo = raiz.querySelector('#investments-conteudo');

  ligarSeletores(raiz, signal); // a lista do cartão no formulário de parcelamento

  const formulario = iniciarCartaoForm(raiz, {
    signal,
    salvar: (dados, modo, atual) => (modo === 'novo'
      ? agir(() => criarCartao(dados), 'Cartão criado.', 'Não foi possível criar o cartão.')
      : agir(() => atualizarCartao(atual.id, dados), 'Cartão atualizado.', 'Não foi possível atualizar o cartão.')),
  });
  const cartoes = iniciarCartoes(raiz, {
    signal,
    novo: () => formulario.abrirNovo(),
    editar: (cartao) => formulario.abrirEditar(cartao),
    excluir: async (cartao) => {
      if (!(await confirmar(`Excluir o cartão "${cartao.nome}"? As compras dele continuam em Transações, sem o vínculo com o cartão.`, 'aviso'))) return;
      await agir(() => excluirCartao(cartao.id), 'Cartão excluído.', 'Não foi possível excluir o cartão.').catch(() => {});
    },
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
      const [{ cartoes: lista }, dadosDosParcelamentos] = await Promise.all([listarCartoes(), listarParcelamentos()]);
      if (minha !== estado.sequencia) return;

      cartoes.mostrar(lista);
      parcelamentos.definirCartoes(lista);
      parcelamentos.mostrar(dadosDosParcelamentos);

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
