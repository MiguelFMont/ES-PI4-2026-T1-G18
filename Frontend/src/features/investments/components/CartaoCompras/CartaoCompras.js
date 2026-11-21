import { listarTransacoes } from '../../../transactions/services/transactionsService.js';
import { CATEGORIAS, rotuloDe } from '../../../transactions/utils/constants.js';
import { formatarData, formatarMoeda } from '../../../../shared/utils/moeda.js';
import { mensagemDeErro } from '../../utils/constants.js';

const POR_VEZ = 50; // as compras mais recentes; se houver mais, a tela avisa quantas faltam

/**
 * Liga as compras do cartão escolhido (HTML em CartaoCompras.html): busca as despesas no crédito dele
 * (GET /transactions?cartaoId=) e as mostra em uma tabela, da mais recente para a mais antiga, com a soma. Todo texto
 * entra com textContent (vem da API). `signal` desliga a busca quando a tela sai.
 * Devolve { mostrar(cartao) } (cartão = um item da lista de GET /investments/cards) e { esconder() }.
 */
export function iniciarCompras(raiz, { signal } = {}) {
  const area = raiz.querySelector('#invest-compras-area');
  const titulo = raiz.querySelector('#invest-compras-titulo');
  const resumo = raiz.querySelector('#invest-compras-resumo');
  const carregando = raiz.querySelector('#invest-compras-carregando');
  const erro = raiz.querySelector('#invest-compras-erro');
  const erroTexto = raiz.querySelector('#invest-compras-erro-texto');
  const vazio = raiz.querySelector('#invest-compras-vazio');
  const conteudo = raiz.querySelector('#invest-compras-conteudo');
  const linhas = raiz.querySelector('#invest-compras-linhas');
  const mais = raiz.querySelector('#invest-compras-mais');
  const modelo = raiz.querySelector('#modelo-compra');

  let cartaoAtual = null;
  let sequencia = 0; // uma resposta de outro cartão que ainda esteja a caminho deixa de valer
  signal?.addEventListener('abort', () => { sequencia += 1; });

  /** Mostra só um dos estados. */
  function estado(qual) {
    carregando.hidden = qual !== 'carregando';
    erro.hidden = qual !== 'erro';
    vazio.hidden = qual !== 'vazio';
    conteudo.hidden = qual !== 'lista';
  }

  const campo = (linha, nome) => linha.querySelector(`[data-campo="${nome}"]`);

  function criarLinha(t) {
    const linha = modelo.content.firstElementChild.cloneNode(true);
    campo(linha, 'data').textContent = formatarData(t.data);
    campo(linha, 'descricao').textContent = t.descricao;
    campo(linha, 'categoria').textContent = rotuloDe(CATEGORIAS, t.categoria);
    campo(linha, 'parcelas').textContent = t.parcelas > 1 ? `${t.parcelas}x de ${formatarMoeda(t.valor / t.parcelas)}` : 'À vista';
    campo(linha, 'valor').textContent = formatarMoeda(t.valor);
    return linha;
  }

  async function buscar() {
    const minha = ++sequencia;
    estado('carregando');
    mais.hidden = true;
    resumo.textContent = '';
    try {
      const resposta = await listarTransacoes({ cartaoId: cartaoAtual.id, limite: POR_VEZ });
      if (minha !== sequencia) return;

      if (resposta.total === 0) {
        estado('vazio');
        return;
      }
      linhas.replaceChildren(...resposta.itens.map(criarLinha));
      resumo.textContent = `${resposta.total} ${resposta.total === 1 ? 'compra' : 'compras'} · total ${formatarMoeda(resposta.resumo.despesas)}`;
      if (resposta.total > resposta.itens.length) {
        mais.hidden = false;
        mais.textContent = `Mostrando as ${resposta.itens.length} mais recentes de ${resposta.total} compras. As outras estão em Transações.`;
      }
      estado('lista');
    } catch (falha) {
      if (minha !== sequencia) return;
      erroTexto.textContent = mensagemDeErro(falha, 'Não foi possível carregar as compras do cartão.');
      estado('erro');
    }
  }

  raiz.querySelector('#invest-compras-tentar-novamente').addEventListener('click', () => buscar(), { signal });

  return {
    /** Mostra as compras do cartão (e busca de novo na API). */
    mostrar(cartao) {
      cartaoAtual = cartao;
      titulo.textContent = `Compras no cartão ${cartao.nome}`;
      area.hidden = false;
      return buscar();
    },

    esconder() {
      cartaoAtual = null;
      sequencia += 1;
      area.hidden = true;
    },
  };
}
