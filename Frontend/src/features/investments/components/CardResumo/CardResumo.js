import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { formatarData, formatarMoeda, valorParaCampo, lerValor } from '../../../../shared/utils/moeda.js';
import { lerInteiro } from '../../utils/constants.js';

const MENSAGENS = {
  limite: 'Informe um limite maior que zero.',
  dia: 'Informe um dia de 1 a 28.',
};
const CAMPO_DA_API = { limite: 'limite', diaVencimento: 'dia' };

const MES_EM_TEXTO = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Liga o cartão simulado (HTML em CardResumo.html): a fatura do mês, o vencimento, o limite e o formulário para mudar o
 * limite e o dia do vencimento. A tela decide o que fazer ao salvar (`salvar(alteracoes)` devolve uma Promise).
 * Devolve { atualizar(cartao) }, com a resposta de GET /investments/card.
 */
export function iniciarCartao(raiz, { signal, salvar }) {
  const formulario = raiz.querySelector('#invest-cartao-form');
  const botaoEditar = raiz.querySelector('#invest-cartao-editar');
  const botaoSalvar = raiz.querySelector('#invest-cartao-salvar');
  const barra = raiz.querySelector('#invest-limite-barra');
  const aviso = raiz.querySelector('#invest-limite-aviso');

  const campos = {
    limite: ligarCampo(formulario, 'invest-cartao-limite'),
    dia: ligarCampo(formulario, 'invest-cartao-dia'),
  };
  aplicarMascaraMoeda(campos.limite.controle);

  let cartaoAtual = null;

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function abrir() {
    limparErros();
    campos.limite.definir(valorParaCampo(cartaoAtual.limite));
    campos.dia.definir(String(cartaoAtual.diaVencimento));
    formulario.hidden = false;
    botaoEditar.setAttribute('aria-expanded', 'true');
    campos.limite.focar();
  }

  function fechar() {
    formulario.hidden = true;
    botaoEditar.setAttribute('aria-expanded', 'false');
    limparErros();
  }

  botaoEditar.addEventListener('click', () => (formulario.hidden ? abrir() : fechar()), { signal });
  raiz.querySelector('#invest-cartao-cancelar').addEventListener('click', fechar, { signal });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    const limite = lerValor(campos.limite.ler());
    const dia = lerInteiro(campos.dia.ler());
    const erros = {};
    if (!(limite > 0)) erros.limite = MENSAGENS.limite;
    if (!(dia >= 1 && dia <= 28)) erros.dia = MENSAGENS.dia;
    if (Object.keys(erros).length > 0) {
      for (const [campo, mensagem] of Object.entries(erros)) campos[campo].definirErro(mensagem);
      campos[Object.keys(erros)[0]].focar();
      return;
    }

    botaoSalvar.disabled = true;
    try {
      await salvar({ limite, diaVencimento: dia });
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

  const texto = (id, valor) => {
    raiz.querySelector(id).textContent = valor;
  };

  return {
    atualizar(cartao) {
      cartaoAtual = cartao;
      const { fatura } = cartao;

      texto('#invest-fatura-mes', MES_EM_TEXTO.format(new Date(`${fatura.mes}-01T00:00:00Z`)));
      texto('#invest-fatura-valor', formatarMoeda(fatura.valor));
      texto('#invest-fatura-compras', formatarMoeda(fatura.comprasNoCredito));
      texto('#invest-fatura-parcelas', formatarMoeda(fatura.parcelasDoMes));

      const quando = fatura.diasParaVencer === 0 ? 'vence hoje' : `em ${fatura.diasParaVencer} ${fatura.diasParaVencer === 1 ? 'dia' : 'dias'}`;
      texto('#invest-fatura-vencimento', `Vencimento em ${formatarData(`${fatura.vencimento}T00:00:00Z`)} (${quando})`);

      texto('#invest-limite-disponivel', formatarMoeda(cartao.limiteDisponivel));
      texto('#invest-limite-total', formatarMoeda(cartao.limite));

      // a barra mostra quanto do limite está em uso: compras do mês e o saldo devedor dos parcelamentos
      const usado = cartao.limite - cartao.limiteDisponivel;
      const percentual = Math.min(100, Math.max(0, (usado / cartao.limite) * 100));
      barra.setAttribute('aria-valuenow', String(Math.round(percentual)));
      barra.style.setProperty('--uso', `${percentual}%`);
      barra.classList.toggle('investments-barra--alerta', percentual >= 80);

      const excedido = cartao.limiteDisponivel < 0;
      aviso.hidden = !excedido;
      aviso.textContent = excedido ? `Limite excedido em ${formatarMoeda(-cartao.limiteDisponivel)}.` : '';
    },
  };
}
