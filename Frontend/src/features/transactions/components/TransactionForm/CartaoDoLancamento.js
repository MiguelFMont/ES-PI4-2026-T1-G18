/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import { listarCartoes } from '../../../investments/services/investmentsService.js';
import { definirAvatar, iniciais } from '../../../../shared/utils/avatar.js';
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
 * - Só aparecem os cartões vinculados à CONTA escolhida no formulário (`conta()` devolve o id); `atualizarConta()` refaz a lista quando ela muda. Uma
 *   compra no cartão sai da conta do cartão: não dá para lançar na conta A pagando com o cartão da conta B.
 * - As parcelas se digitam (de 1 a 24).
 *
 * Devolve { ler(), validar(), reiniciar(), recarregar(), atualizarConta(), definirErro(mensagem), focar() }: `ler()` devolve
 * { cartaoId?, parcelas } no crédito (ou null), e `validar()`, a mensagem de erro (ou null).
 */
export function ligarCartao(raiz, { signal, formaPagamento, tipo, valor, conta, abrirCartaoRapido }) {
  const areaCartao = raiz.querySelector('#campo-cartao-area');
  const areaParcelas = raiz.querySelector('#campo-parcelas-area');
  const selectCartao = raiz.querySelector('#campo-cartao');
  const selectParcelas = raiz.querySelector('#campo-parcelas'); // um campo de texto: as parcelas se digitam
  const ajuda = raiz.querySelector('#campo-parcelas-ajuda');
  const aviso = raiz.querySelector('#campo-cartao-aviso');
  const erro = raiz.querySelector('#campo-cartao-erro');
  const botaoCriar = raiz.querySelector('#campo-cartao-criar');

  let cartoes = [];
  let carregou = false;
  let buscando = false;

  const credito = () => formaPagamento.ler() === 'credito';
  const despesa = () => tipo.ler() !== 'receita'; // sem tipo escolhido, o formulário trata como despesa (o padrão da tela)

  function definirAviso(mensagem) {
    aviso.hidden = !mensagem;
    aviso.textContent = mensagem ?? '';
  }

  /** Os cartões da conta escolhida (cartões antigos, sem conta, valem para qualquer conta). */
  const cartoesDaConta = () => cartoes.filter((c) => !c.contaId || c.contaId === conta());
  const semCartaoNaConta = () => carregou && cartoesDaConta().length === 0;

  // as parcelas: só dígitos, de 1 a 24 (vazio conta como inválido ao salvar)
  selectParcelas.addEventListener('input', () => {
    selectParcelas.value = selectParcelas.value.replace(/\D/g, '').slice(0, 2);
    atualizarAjuda();
  }, { signal });
  const lerParcelas = () => (selectParcelas.value === '' ? NaN : Number(selectParcelas.value));

  function atualizarAjuda() {
    const parcelas = lerParcelas();
    const total = valor();
    ajuda.textContent = parcelas > 1 && total > 0 ? `${parcelas}x de ${formatarMoeda(total / parcelas)}` : '';
  }

  function preencherCartoes() {
    // troca só as <option>: o <select> tem dentro o <button><selectedcontent> que mostra o texto escolhido (replaceChildren o apagaria)
    for (const antiga of selectCartao.querySelectorAll('option')) antiga.remove();
    const escolhido = selectCartao.value;
    const lista = cartoesDaConta();
    // "cartão | conta | banco", como nas outras listas de cartão
    for (const cartao of lista) {
      const opcao = new Option(cartao.conta ? `${cartao.nome} | ${cartao.conta.nome} | ${cartao.conta.bancoNome}` : `${cartao.nome} | sem conta`, cartao.id);
      definirAvatar(opcao, { banco: cartao.conta?.banco, sigla: iniciais(cartao.nome), forma: 'quadrado', titulo: cartao.nome, subtitulo: cartao.conta ? `${cartao.conta.nome} · ${cartao.conta.bancoNome}` : 'sem conta', icone: cartao.icone, cor: cartao.cor });
      selectCartao.add(opcao);
    }
    selectCartao.value = lista.some((c) => c.id === escolhido) ? escolhido : (lista[0]?.id ?? ''); // o mais antigo da conta vem primeiro
    selectCartao.dispatchEvent(new Event('change', { bubbles: true })); // a lista do select mostra a escolha
  }

  // Toda compra no crédito precisa de um cartão: numa conta sem cartão, em vez da lista aparece o botão que leva o usuário a criar um
  function avisoDaConta() {
    const sem = semCartaoNaConta();
    areaCartao.classList.toggle('campo-cartao--sem', sem);
    botaoCriar.hidden = !sem;
    definirAviso(sem ? 'Esta conta ainda não tem cartão, e toda compra no crédito precisa de um.' : null);
  }

  // O botão abre a janela "Novo cartão" por cima do lançamento (TransactionCartao.js), já com a conta escolhida: nada do que foi digitado se perde.
  // Quando o Backend cria o cartão, a janela chama `cartaoCriado` (abaixo), que atualiza a lista e já escolhe o novo cartão.
  botaoCriar.addEventListener('click', () => abrirCartaoRapido?.(), { signal });
  // o botão "Criar outro cartão" do rodapé da lista de cartões (data-folha-rodape no campo) faz o mesmo
  areaCartao.addEventListener('seletor:rodape', () => abrirCartaoRapido?.(), { signal });

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
      // ter cartão é opcional: sem nenhum (ou sem nenhum na conta escolhida), a compra no crédito entra à vista e parcelar pede um cartão da conta
      avisoDaConta();
      atualizarVisibilidade();
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
    areaParcelas.hidden = !(noCredito && despesa() && !semCartaoNaConta());
    if (areaParcelas.hidden) selectParcelas.value = '1'; // parcelar só vale em despesa no crédito, com um cartão da conta
    if (noCredito && !carregou) buscar();
    if (!noCredito) definirErro(null);
    atualizarAjuda();
  }

  raiz.querySelector('#campo-formaPagamento').addEventListener('change', atualizarVisibilidade, { signal });
  for (const opcao of raiz.querySelectorAll('input[name="tipo"]')) opcao.addEventListener('change', atualizarVisibilidade, { signal });
  raiz.querySelector('#campo-valor').addEventListener('input', atualizarAjuda, { signal });

  function definirErro(mensagem) {
    erro.hidden = !mensagem;
    erro.textContent = mensagem ?? '';
  }

  return {
    ler() {
      if (!credito()) return null;
      return { cartaoId: selectCartao.value || undefined, parcelas: despesa() ? lerParcelas() : 1 };
    },

    validar() {
      if (!credito()) return null;
      if (semCartaoNaConta()) return 'Crie um cartão para esta conta antes de lançar no crédito.';
      if (cartoesDaConta().length > 0 && !selectCartao.value) return MENSAGEM_ESCOLHA;
      if (!areaParcelas.hidden && !(Number.isInteger(lerParcelas()) && lerParcelas() >= 1 && lerParcelas() <= 24)) return 'Informe de 1 a 24 parcelas.';
      return null;
    },

    /** Depois de salvar uma transação: esconde as áreas e volta as parcelas para à vista (o cartão escolhido continua). */
    reiniciar() {
      selectParcelas.value = '1';
      definirErro(null);
      atualizarVisibilidade();
    },

    /** A conta do formulário mudou: refaz a lista com os cartões dela. */
    atualizarConta() {
      if (!carregou) return;
      preencherCartoes();
      avisoDaConta();
      atualizarVisibilidade();
    },

    /** Um cartão acabou de ser criado pela janela "Novo cartão": busca a lista de novo e escolhe ele (os campos do lançamento continuam como estavam). */
    async cartaoCriado(cartao) {
      carregou = false;
      await buscar();
      if ([...selectCartao.options].some((o) => o.value === cartao.id)) {
        selectCartao.value = cartao.id;
        selectCartao.dispatchEvent(new Event('change', { bubbles: true }));
      }
      avisoDaConta();
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
