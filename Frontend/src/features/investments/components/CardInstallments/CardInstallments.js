import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { formatarMoeda, lerTaxa, lerValor } from '../../../../shared/utils/moeda.js';
import { lerInteiro } from '../../utils/constants.js';

const MAX_PARCELAS = 120;

const MENSAGENS = {
  descricao: 'Informe a descrição.',
  valor: 'Informe um valor maior que zero.',
  parcelas: `Informe de 1 a ${MAX_PARCELAS} parcelas.`,
  pagas: 'Informe quantas parcelas já foram pagas (não pode passar do total).',
  juros: 'Informe uma taxa de 0% a 100%.',
};
const CAMPO_DA_API = { descricao: 'descricao', valorTotal: 'valor', parcelas: 'parcelas', parcelasPagas: 'pagas', taxaJurosMensal: 'juros' };

/**
 * Liga os parcelamentos do cartão (HTML em CardInstallments.html): os totais, a lista e o formulário de novo parcelamento.
 * A tela decide o que fazer em cada ação (`criar(dados)` devolve uma Promise, `pagar(parcelamento)` e `excluir(parcelamento)`).
 * Todo texto entra com textContent (vem da API). Devolve { mostrar(resposta) }, com a resposta de GET .../installments.
 */
export function iniciarParcelamentos(raiz, { signal, criar, pagar, excluir }) {
  const formulario = raiz.querySelector('#invest-parcelamento-form');
  const botaoNovo = raiz.querySelector('#invest-novo-parcelamento');
  const botaoSalvar = raiz.querySelector('#invest-parc-salvar');
  const vazio = raiz.querySelector('#invest-parcelas-vazio');
  const conteudo = raiz.querySelector('#invest-parcelas-conteudo');
  const itens = raiz.querySelector('#invest-parcelas-itens');
  const modelo = raiz.querySelector('#modelo-parcelamento');

  const campos = {
    descricao: ligarCampo(formulario, 'invest-parc-descricao'),
    valor: ligarCampo(formulario, 'invest-parc-valor'),
    parcelas: ligarCampo(formulario, 'invest-parc-parcelas'),
    pagas: ligarCampo(formulario, 'invest-parc-pagas'),
    juros: ligarCampo(formulario, 'invest-parc-juros'),
  };
  aplicarMascaraMoeda(campos.valor.controle);

  const parcelamentosPorId = new Map();

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function abrir() {
    limparErros();
    formulario.hidden = false;
    botaoNovo.setAttribute('aria-expanded', 'true');
    campos.descricao.focar();
  }

  function fechar() {
    formulario.hidden = true;
    botaoNovo.setAttribute('aria-expanded', 'false');
    formulario.reset();
    limparErros();
  }

  /** Lê e valida os campos. Devolve { erros, dados }: `dados` é null se houver erro. */
  function lerFormulario() {
    const erros = {};
    const descricao = campos.descricao.ler().trim();
    if (!descricao || descricao.length > 100) erros.descricao = MENSAGENS.descricao;

    const valor = lerValor(campos.valor.ler());
    if (!(valor > 0)) erros.valor = MENSAGENS.valor;

    const parcelas = lerInteiro(campos.parcelas.ler());
    if (!(parcelas >= 1 && parcelas <= MAX_PARCELAS)) erros.parcelas = MENSAGENS.parcelas;

    const textoPagas = campos.pagas.ler().trim();
    const pagas = textoPagas === '' ? 0 : lerInteiro(textoPagas);
    if (Number.isNaN(pagas) || pagas > parcelas) erros.pagas = MENSAGENS.pagas;

    const textoJuros = campos.juros.ler().trim();
    const juros = textoJuros === '' ? 0 : lerTaxa(textoJuros);
    if (Number.isNaN(juros) || juros < 0 || juros > 100) erros.juros = MENSAGENS.juros;

    if (Object.keys(erros).length > 0) return { erros, dados: null };
    return { erros, dados: { descricao, valorTotal: valor, parcelas, parcelasPagas: pagas, taxaJurosMensal: juros } };
  }

  botaoNovo.addEventListener('click', () => (formulario.hidden ? abrir() : fechar()), { signal });
  raiz.querySelector('#invest-parc-cancelar').addEventListener('click', fechar, { signal });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    const { erros, dados } = lerFormulario();
    if (!dados) {
      for (const [campo, mensagem] of Object.entries(erros)) campos[campo].definirErro(mensagem);
      campos[Object.keys(erros)[0]].focar();
      return;
    }

    botaoSalvar.disabled = true;
    try {
      await criar(dados);
      fechar();
    } catch (erro) {
      for (const campoApi of Object.keys(erro?.details ?? {})) {
        const campo = CAMPO_DA_API[campoApi];
        if (campo) campos[campo].definirErro(MENSAGENS[campo]);
      }
    } finally {
      botaoSalvar.disabled = false;
    }
  }, { signal });

  // Um só ouvinte para os botões de todos os cartões (delegação): os cartões são criados e apagados a cada carga.
  itens.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-acao]');
    const parcelamento = parcelamentosPorId.get(botao?.closest('li[data-id]')?.dataset.id);
    if (!botao || !parcelamento) return;
    if (botao.dataset.acao === 'pagar') pagar(parcelamento);
    else if (botao.dataset.acao === 'excluir') excluir(parcelamento);
  }, { signal });

  const campo = (cartao, nome) => cartao.querySelector(`[data-campo="${nome}"]`);

  function criarCartao(p) {
    const cartao = modelo.content.firstElementChild.cloneNode(true);
    cartao.dataset.id = p.id;

    campo(cartao, 'descricao').textContent = p.descricao;
    campo(cartao, 'parcela').textContent = formatarMoeda(p.valorParcela);
    campo(cartao, 'saldo').textContent = formatarMoeda(p.saldoDevedor);
    campo(cartao, 'juros').textContent = formatarMoeda(p.jurosTotal);
    campo(cartao, 'resumo').textContent = p.quitado
      ? `Quitado: as ${p.parcelas} parcelas foram pagas (total de ${formatarMoeda(p.valorTotal)}).`
      : `${p.parcelasPagas} de ${p.parcelas} parcelas pagas, faltam ${p.parcelasRestantes}. ` +
        `Valor financiado: ${formatarMoeda(p.valorTotal)}${p.taxaJurosMensal > 0 ? ` a ${p.taxaJurosMensal.toLocaleString('pt-BR')}% ao mês` : ' sem juros'}.`;

    const status = campo(cartao, 'status');
    status.textContent = p.quitado ? 'Quitado' : 'Ativo';
    status.classList.add(p.quitado ? 'investments-status--ok' : 'investments-status--andamento');

    const botaoPagar = cartao.querySelector('[data-acao="pagar"]');
    botaoPagar.disabled = p.quitado;
    botaoPagar.setAttribute('aria-label', `Pagar uma parcela de ${p.descricao}`);
    cartao.querySelector('[data-acao="excluir"]').setAttribute('aria-label', `Excluir ${p.descricao}`);
    // um parcelamento criado por uma compra parcelada só sai excluindo a transação (o Backend recusa a exclusão direta)
    const deCompra = Boolean(p.transacaoId);
    cartao.querySelector('[data-acao="excluir"]').hidden = deCompra;
    campo(cartao, 'deCompra').hidden = !deCompra;
    return cartao;
  }

  return {
    mostrar(resposta) {
      parcelamentosPorId.clear();
      for (const p of resposta.parcelamentos) parcelamentosPorId.set(p.id, p);
      itens.replaceChildren(...resposta.parcelamentos.map(criarCartao));

      const vazia = resposta.parcelamentos.length === 0;
      vazio.hidden = !vazia;
      conteudo.hidden = vazia;
      raiz.querySelector('#invest-parcelas-total-mes').textContent = formatarMoeda(resposta.totalParcelasDoMes);
      raiz.querySelector('#invest-parcelas-total-saldo').textContent = formatarMoeda(resposta.totalSaldoDevedor);
      raiz.querySelector('#invest-parcelas-total-juros').textContent = formatarMoeda(resposta.totalJuros);
    },
  };
}
