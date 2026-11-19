import { listarCartoes } from '../../../investments/services/investmentsService.js';
import { formatarMoeda } from '../../../../shared/utils/moeda.js';

const MENSAGEM_ESCOLHA = 'Escolha o cartão.';

/**
 * Liga o trecho "Cartão" e "Parcelas" do formulário de transação (HTML em TransactionForm.html). Quando o método de
 * pagamento é Cartão de crédito, o usuário escolhe em qual dos seus cartões a compra foi feita e, em despesa, em quantas
 * parcelas. Uma compra parcelada cria o parcelamento dela no cartão (aba Cartão).
 *
 * - Os cartões são buscados na primeira vez que o crédito é escolhido; o mais antigo (o padrão) já vem marcado.
 * - Se a busca falhar, o aviso diz que a compra vai para o cartão padrão (o Backend usa o mais antigo sem cartaoId).
 * - `campos` traz os outros campos do formulário que importam aqui: formaPagamento e tipo (com ler()) e `valor()`, o valor
 *   digitado em número (NaN se ainda não for válido), para mostrar de quanto fica cada parcela.
 *
 * Devolve { ler(), validar(), reiniciar(), recarregar(), definirErro(mensagem), focar() }: `ler()` devolve
 * { cartaoId?, parcelas } no crédito (ou null), e `validar()`, a mensagem de erro (ou null).
 */
export function ligarCartao(raiz, { signal, formaPagamento, tipo, valor }) {
  const areaCartao = raiz.querySelector('#campo-cartao-area');
  const areaParcelas = raiz.querySelector('#campo-parcelas-area');
  const selectCartao = raiz.querySelector('#campo-cartao');
  const selectParcelas = raiz.querySelector('#campo-parcelas');
  const ajuda = raiz.querySelector('#campo-parcelas-ajuda');
  const aviso = raiz.querySelector('#campo-cartao-aviso');
  const erro = raiz.querySelector('#campo-cartao-erro');

  let cartoes = [];
  let carregou = false;
  let buscando = false;

  const credito = () => formaPagamento.ler() === 'credito';
  const despesa = () => tipo.ler() !== 'receita'; // sem tipo escolhido, o formulário trata como despesa (o padrão da tela)

  function definirAviso(mensagem) {
    aviso.hidden = !mensagem;
    aviso.textContent = mensagem ?? '';
  }

  function atualizarAjuda() {
    const parcelas = Number(selectParcelas.value);
    const total = valor();
    ajuda.textContent = parcelas > 1 && total > 0 ? `${parcelas}x de ${formatarMoeda(total / parcelas)}` : '';
  }

  function preencherCartoes() {
    selectCartao.replaceChildren(...cartoes.map((cartao) => {
      const opcao = document.createElement('option');
      opcao.value = cartao.id;
      opcao.textContent = cartao.nome;
      return opcao;
    }));
    if (cartoes.length > 0) selectCartao.value = cartoes[0].id; // o mais antigo (o padrão) vem primeiro
  }

  async function buscar() {
    if (buscando) return;
    buscando = true;
    definirAviso('Carregando seus cartões...');
    try {
      const resposta = await listarCartoes();
      if (signal?.aborted) return;
      cartoes = resposta.cartoes;
      preencherCartoes();
      carregou = true;
      definirAviso(null);
    } catch {
      if (signal?.aborted) return;
      cartoes = [];
      preencherCartoes();
      carregou = true;
      definirAviso('Não foi possível carregar seus cartões. A compra será registrada no cartão padrão.');
    } finally {
      buscando = false;
    }
  }

  function atualizarVisibilidade() {
    const noCredito = credito();
    areaCartao.hidden = !noCredito;
    areaParcelas.hidden = !(noCredito && despesa());
    if (areaParcelas.hidden) selectParcelas.value = '1'; // parcelar só vale em despesa no crédito
    if (noCredito && !carregou) buscar();
    if (!noCredito) definirErro(null);
    atualizarAjuda();
  }

  raiz.querySelector('#campo-formaPagamento').addEventListener('change', atualizarVisibilidade, { signal });
  for (const opcao of raiz.querySelectorAll('input[name="tipo"]')) opcao.addEventListener('change', atualizarVisibilidade, { signal });
  raiz.querySelector('#campo-valor').addEventListener('input', atualizarAjuda, { signal });
  selectParcelas.addEventListener('change', atualizarAjuda, { signal });

  function definirErro(mensagem) {
    erro.hidden = !mensagem;
    erro.textContent = mensagem ?? '';
  }

  return {
    ler() {
      if (!credito()) return null;
      return { cartaoId: selectCartao.value || undefined, parcelas: despesa() ? Number(selectParcelas.value) : 1 };
    },

    validar() {
      return credito() && cartoes.length > 0 && !selectCartao.value ? MENSAGEM_ESCOLHA : null;
    },

    /** Depois de salvar uma transação: esconde as áreas e volta as parcelas para à vista (o cartão escolhido continua). */
    reiniciar() {
      selectParcelas.value = '1';
      definirErro(null);
      atualizarVisibilidade();
    },

    /** O cartão escolhido foi excluído (em outra aba, por exemplo): busca a lista de novo. */
    async recarregar() {
      carregou = false;
      await buscar();
    },

    definirErro,
    focar: () => selectCartao.focus(),
  };
}
