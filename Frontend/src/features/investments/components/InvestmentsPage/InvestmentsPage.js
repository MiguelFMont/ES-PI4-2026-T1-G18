import {
  atualizarCartao,
  criarCartao,
  excluirCartao,
  listarCartoes,
} from '../../services/investmentsService.js';
import { notificar, confirmar } from '../../../../shared/components/notificacao.js';
import { mensagemDeErro } from '../../utils/constants.js';
import { iniciarCartoes } from '../CartoesLista/CartoesLista.js';
import { iniciarCartaoForm } from '../CartaoForm/CartaoForm.js';
import { iniciarCompras } from '../CartaoCompras/CartaoCompras.js';

/**
 * Liga a página do Cartão de crédito ao HTML de views/investments.html (já dentro do container): um card para cada cartão
 * do usuário (fatura e limite), o formulário de cartão e, embaixo, as compras do cartão escolhido (o primeiro, ao abrir).
 * Os parcelamentos nascem das compras parceladas feitas em Transações (campo Parcelas). A estrutura da tela está toda no
 * HTML; aqui ficam só as partes que mudam com os dados. `signal` (de um AbortController) avisa que a tela foi desmontada.
 */
export function iniciarPaginaCartao(raiz, { signal } = {}) {
  const estado = { sequencia: 0, cartaoId: null }; // cartaoId: o cartão escolhido (null = o primeiro)

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
  const compras = iniciarCompras(raiz, { signal });
  const cartoes = iniciarCartoes(raiz, {
    signal,
    selecionar: (cartao) => {
      if (cartao.id === estado.cartaoId) return;
      estado.cartaoId = cartao.id;
      mostrarEscolhido();
    },
    novo: () => formulario.abrirNovo(),
    editar: (cartao) => formulario.abrirEditar(cartao),
    excluir: async (cartao) => {
      if (!(await confirmar(`Excluir o cartão "${cartao.nome}"? As compras dele continuam em Transações, sem o vínculo com o cartão.`, 'aviso'))) return;
      await agir(() => excluirCartao(cartao.id), 'Cartão excluído.', 'Não foi possível excluir o cartão.').catch(() => {});
    },
  });

  let lista = []; // os cartões carregados

  raiz.querySelector('#investments-tentar-novamente').addEventListener('click', () => carregar(), { signal });

  /** Marca o card escolhido e mostra as compras dele. */
  function mostrarEscolhido() {
    cartoes.mostrar(lista, estado.cartaoId);
    compras.mostrar(lista.find((c) => c.id === estado.cartaoId));
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
      if (!lista.some((c) => c.id === estado.cartaoId)) estado.cartaoId = lista[0].id; // o escolhido sumiu: volta ao padrão

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
