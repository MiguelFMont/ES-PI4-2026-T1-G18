import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { valorParaCampo, lerValor } from '../../../../shared/utils/moeda.js';
import { lerInteiro } from '../../utils/constants.js';

const LIMITE_PADRAO = 5000;
const DIA_PADRAO = 10;

const MENSAGENS = {
  nome: 'Informe um nome de até 40 caracteres.',
  nomeEmUso: 'Já existe um cartão com esse nome.',
  limite: 'Informe um limite maior que zero.',
  dia: 'Informe um dia de 1 a 28.',
};
const CAMPO_DA_API = { nome: 'nome', limite: 'limite', diaVencimento: 'dia' };

/**
 * Liga o formulário de cartão (HTML em CartaoForm.html): criar um cartão novo ou mudar o nome, o limite e o dia do
 * vencimento de um cartão que já existe. A tela decide o que fazer ao salvar: `salvar(dados, modo, cartao)` (modo 'novo' ou
 * 'editar'; `cartao` é o que está sendo editado) devolve uma Promise.
 * Devolve { abrirNovo(), abrirEditar(cartao), fechar() }.
 */
export function iniciarCartaoForm(raiz, { signal, salvar }) {
  const area = raiz.querySelector('#invest-cartao-form-area');
  const formulario = raiz.querySelector('#invest-cartao-form');
  const titulo = raiz.querySelector('#invest-cartao-form-titulo');
  const botaoSalvar = raiz.querySelector('#invest-cartao-salvar');

  const campos = {
    nome: ligarCampo(formulario, 'invest-cartao-nome'),
    limite: ligarCampo(formulario, 'invest-cartao-limite'),
    dia: ligarCampo(formulario, 'invest-cartao-dia'),
  };
  aplicarMascaraMoeda(campos.limite.controle);

  let modo = 'novo';
  let cartaoAtual = null; // o cartão que está sendo editado (null ao criar)

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function abrir(novoModo, cartao) {
    modo = novoModo;
    cartaoAtual = cartao ?? null;
    limparErros();
    const novo = modo === 'novo';
    titulo.textContent = novo ? 'Novo cartão' : `Editar o cartão ${cartao.nome}`;
    botaoSalvar.textContent = novo ? 'Criar cartão' : 'Salvar cartão';
    campos.nome.definir(novo ? '' : cartao.nome);
    campos.limite.definir(valorParaCampo(novo ? LIMITE_PADRAO : cartao.limite));
    campos.dia.definir(String(novo ? DIA_PADRAO : cartao.diaVencimento));
    area.hidden = false;
    area.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    campos.nome.focar();
  }

  function fechar() {
    area.hidden = true;
    cartaoAtual = null;
    limparErros();
  }

  raiz.querySelector('#invest-cartao-cancelar').addEventListener('click', fechar, { signal });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    const nome = campos.nome.ler().trim();
    const limite = lerValor(campos.limite.ler());
    const dia = lerInteiro(campos.dia.ler());
    const erros = {};
    if (!nome || nome.length > 40) erros.nome = MENSAGENS.nome;
    if (!(limite > 0)) erros.limite = MENSAGENS.limite;
    if (!(dia >= 1 && dia <= 28)) erros.dia = MENSAGENS.dia;
    if (Object.keys(erros).length > 0) {
      for (const [campo, mensagem] of Object.entries(erros)) campos[campo].definirErro(mensagem);
      campos[Object.keys(erros)[0]].focar();
      return;
    }

    botaoSalvar.disabled = true;
    try {
      await salvar({ nome, limite, diaVencimento: dia }, modo, cartaoAtual);
      fechar();
    } catch (erro) {
      if (erro?.code === 'CARD_NAME_TAKEN') campos.nome.definirErro(MENSAGENS.nomeEmUso);
      for (const campoApi of Object.keys(erro?.details ?? {})) {
        const campo = CAMPO_DA_API[campoApi];
        if (campo) campos[campo].definirErro(MENSAGENS[campo]);
      }
    } finally {
      botaoSalvar.disabled = false;
    }
  }, { signal });

  return {
    abrirNovo: () => abrir('novo'),
    abrirEditar: (cartao) => abrir('editar', cartao),
    fechar,
  };
}
