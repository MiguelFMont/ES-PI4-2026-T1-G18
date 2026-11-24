/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import { aplicarMascaraMoeda, ligarCampo } from '../../../../shared/components/campos.js';
import { ligarEscolhaIcone } from '../../../../shared/components/escolhaIcone.js';
import { definirAvatar, iniciais } from '../../../../shared/utils/avatar.js';
import { valorParaCampo, lerValor } from '../../../../shared/utils/moeda.js';
import { lerInteiro } from '../../utils/constants.js';

const LIMITE_PADRAO = 5000;
const DIA_PADRAO = 3; // a fatura fecha no dia 3 e vence 7 dias depois

const MENSAGENS = {
  nome: 'Informe um nome de até 40 caracteres.',
  nomeEmUso: 'Já existe um cartão com esse nome.',
  limite: 'Informe um limite maior que zero.',
  dia: 'Informe um dia de 1 a 28.',
  conta: 'Escolha a conta do cartão.',
};
const CAMPO_DA_API = { nome: 'nome', limite: 'limite', diaFechamento: 'dia', contaId: 'conta' };

/**
 * Liga o formulário de cartão (HTML em CartaoForm.html): criar um cartão novo ou mudar o nome, o limite e o dia do
 * vencimento de um cartão que já existe. A tela decide o que fazer ao salvar: `salvar(dados, modo, cartao)` (modo 'novo' ou
 * 'editar'; `cartao` é o que está sendo editado) devolve uma Promise.
 * A conta do cartão é obrigatória ao criar (o cartão é vinculado a uma conta do usuário); `definirContas(contas)` põe as contas na lista.
 * Devolve { abrirNovo(), abrirEditar(cartao), fechar(), definirContas(contas) }.
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
    conta: ligarCampo(formulario, 'invest-cartao-conta'),
  };
  aplicarMascaraMoeda(campos.limite.controle);
  const aparencia = ligarEscolhaIcone(formulario.querySelector('#invest-cartao-aparencia'), { signal });

  let modo = 'novo';
  let cartaoAtual = null; // o cartão que está sendo editado (null ao criar)

  /** Põe as contas do usuário na lista do campo Conta, mantendo a escolha atual. Troca só as <option>: o <select> tem dentro o <button><selectedcontent>. */
  function definirContas(todas) {
    const contas = todas.filter((c) => c.tipo === 'manual'); // cartão só em conta manual (numa Open Finance os cartões vêm do banco)
    const select = campos.conta.controle;
    const escolhida = select.value;
    for (const antiga of select.querySelectorAll('option')) antiga.remove();
    for (const conta of contas) { const opcao = new Option(`${conta.nome} (${conta.bancoNome})`, conta.id); definirAvatar(opcao, { banco: conta.banco, sigla: iniciais(conta.nome), titulo: conta.nome, subtitulo: conta.bancoNome, icone: conta.icone, cor: conta.cor }); select.add(opcao); }
    select.value = contas.some((c) => c.id === escolhida) ? escolhida : '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function limparErros() {
    for (const campo of Object.values(campos)) campo.definirErro(null);
  }

  function abrir(novoModo, cartao) {
    modo = novoModo;
    cartaoAtual = cartao ?? null;
    limparErros();
    const novo = modo === 'novo';
    const soAparencia = Boolean(cartao?.openFinance); // cartão do Open Finance: só o ícone e a cor mudam
    for (const campo of Object.values(campos)) campo.controle.closest('.campo').hidden = soAparencia;
    titulo.textContent = novo ? 'Novo cartão' : soAparencia ? `Ícone e cor de ${cartao.nome}` : `Editar o cartão ${cartao.nome}`;
    botaoSalvar.textContent = novo ? 'Criar cartão' : 'Salvar cartão';
    campos.nome.definir(novo ? '' : cartao.nome);
    campos.limite.definir(valorParaCampo(novo ? LIMITE_PADRAO : cartao.limite));
    campos.dia.definir(String(novo ? DIA_PADRAO : cartao.diaFechamento));
    aparencia.definir(novo ? {} : { icone: cartao.icone, cor: cartao.cor });
    // ao criar já vem a primeira conta escolhida; ao editar, a conta atual do cartão (cartões antigos podem não ter)
    // a conta vinculada sempre aparece no campo, mesmo que a lista de contas ainda não tenha chegado (ou não a traga): a opção sai dos dados do cartão
    if (!novo && cartao.contaId && cartao.conta && ![...campos.conta.controle.options].some((o) => o.value === cartao.contaId)) {
      const opcao = new Option(`${cartao.conta.nome} (${cartao.conta.bancoNome})`, cartao.contaId);
      definirAvatar(opcao, { banco: cartao.conta.banco, sigla: iniciais(cartao.conta.nome), titulo: cartao.conta.nome, subtitulo: cartao.conta.bancoNome, icone: cartao.conta.icone, cor: cartao.conta.cor });
      campos.conta.controle.add(opcao);
    }
    const opcoes = [...campos.conta.controle.options].map((o) => o.value);
    campos.conta.definir(novo ? (opcoes[0] ?? '') : (cartao.contaId ?? ''));
    campos.conta.controle.dispatchEvent(new Event('change', { bubbles: true }));
    area.hidden = false;
    campos.nome.focar();
  }

  function fechar() {
    area.hidden = true;
    cartaoAtual = null;
    limparErros();
  }

  raiz.querySelector('#invest-cartao-cancelar').addEventListener('click', fechar, { signal });
  // Esc fecha a janela
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !area.hidden && !evento.defaultPrevented) fechar();
  }, { signal });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros();

    if (cartaoAtual?.openFinance) {
      botaoSalvar.disabled = true;
      try {
        await salvar(aparencia.ler(), modo, cartaoAtual);
        fechar();
      } catch {
        // a tela já avisou o erro
      } finally {
        botaoSalvar.disabled = false;
      }
      return;
    }

    const nome = campos.nome.ler().trim();
    const limite = lerValor(campos.limite.ler());
    const dia = lerInteiro(campos.dia.ler());
    const contaId = campos.conta.ler();
    const erros = {};
    if (modo === 'novo' && !contaId) erros.conta = MENSAGENS.conta;
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
      // ícone e cor: ao criar só vão se escolhidos; ao editar, null tira o que já havia (volta ao logo do banco)
      const { icone, cor } = aparencia.ler();
      const visual = modo === 'novo' ? { ...(icone ? { icone } : {}), ...(cor ? { cor } : {}) } : { icone, cor };
      await salvar({ nome, limite, diaFechamento: dia, ...(contaId ? { contaId } : {}), ...visual }, modo, cartaoAtual);
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
    definirContas,
  };
}
