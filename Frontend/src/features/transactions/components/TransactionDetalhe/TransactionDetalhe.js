import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { aplicarMascaraMoeda, tremer } from '../../../../shared/components/campos.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { definirAvatar, iniciais } from '../../../../shared/utils/avatar.js';
import { travarRolagem, liberarRolagem } from '../../../../shared/utils/rolagem.js';
import { valorParaCampo } from '../../../../shared/utils/moeda.js';
import { validarCampo } from '../../utils/formValidation.js';
import { formatarMoeda } from '../../utils/format.js';

// Os campos do painel: data e observação sempre à vista; os demais aparecem no modo "todos os campos"
const CAMPOS = ['descricao', 'valor', 'tipo', 'categoria', 'formaPagamento', 'metaId', 'contaId', 'cartaoId', 'data', 'observacoes'];
const SELETORES_DE_LISTA = ['tipo', 'categoria', 'formaPagamento', 'metaId', 'contaId', 'cartaoId']; // os que são listas (selects do projeto)
// numa transferência estes campos não existem (e a conta se troca pela própria transferência): as linhas ficam escondidas
const FORA_DA_TRANSFERENCIA = ['tipo', 'categoria', 'formaPagamento', 'metaId', 'contaId', 'cartaoId'];
// o id do controle no HTML: descrição e valor têm o texto de leitura no cabeçalho, então o campo leva "-campo"
const idDe = (nome) => ({ descricao: 'detalhe-descricao-campo', valor: 'detalhe-valor-campo', tipo: 'detalhe-tipo-campo' }[nome] ?? `detalhe-${nome}`);

const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Os valores de uma transação como os campos do painel os mostram (texto). */
function valoresDe(t) {
  return {
    descricao: t.descricao,
    valor: valorParaCampo(t.valor),
    tipo: t.tipo,
    categoria: t.categoria,
    formaPagamento: t.formaPagamento,
    metaId: t.metaId ?? '',
    contaId: t.contaId ?? '',
    cartaoId: t.cartaoId ?? '',
    data: t.data.slice(0, 10),
    observacoes: t.observacoes ?? '',
  };
}

/**
 * Liga o painel de detalhes (HTML em TransactionDetalhe.html). `abrir(transacao)` preenche e mostra o painel, com a data e a observação
 * para editar; "Editar todos os campos" mostra também descrição, valor, tipo, categoria, pagamento e meta. Mudar qualquer campo faz aparecer
 * "Salvar alterações", que manda só o que mudou para `salvar(id, alteracoes)`. `duplicar(transacao)` e `excluir(transacao)` ficam com a
 * página. Todo texto entra com value ou textContent. Devolve { abrir(transacao), fechar(), definirMetas(metas) }.
 */
export function iniciarDetalhe(raiz, { salvar, duplicar, excluir, abrirCartaoRapido, signal }) {
  const painel = raiz.querySelector('#detalhe');
  const fundo = raiz.querySelector('#detalhe-fundo');
  const formulario = raiz.querySelector('#detalhe-form');
  const botaoSalvar = raiz.querySelector('#detalhe-salvar');
  const botaoDuplicar = raiz.querySelector('#detalhe-duplicar');
  const botaoExcluir = raiz.querySelector('#detalhe-excluir');
  const chipTipo = raiz.querySelector('#detalhe-tipo');
  const chipOrigem = raiz.querySelector('#detalhe-origem');
  const notaCredito = raiz.querySelector('#detalhe-credito');
  const textoDescricao = raiz.querySelector('#detalhe-descricao');
  const textoValor = raiz.querySelector('#detalhe-valor');
  const botaoModo = raiz.querySelector('#detalhe-modo');
  const textoModo = raiz.querySelector('#detalhe-modo-texto');
  const extras = raiz.querySelector('#detalhe-extras');
  const cabecalho = raiz.querySelector('.detalhe__cabecalho');
  const controles = Object.fromEntries(CAMPOS.map((nome) => [nome, raiz.querySelector(`#${idDe(nome)}`)]));
  aplicarMascaraMoeda(controles.valor);
  // a data usa o calendário do projeto: ele lê e escreve "AAAA-MM-DD" (a caixa mostra dd/mm/aaaa)
  const calendario = ligarCalendario(controles.data.closest('[data-calendario]'), { signal });
  const ler = (nome) => (nome === 'data' ? calendario.ler() : controles[nome].value);
  const escrever = (nome, valor) => {
    if (nome === 'data') calendario.definir(valor);
    else controles[nome].value = valor;
  };
  const erros = Object.fromEntries(CAMPOS.map((nome) => [nome, raiz.querySelector(`#detalhe-${nome}-erro`)]));

  let cartoes = []; // os cartões do usuário (definirCartoes)
  let cartoesCarregados = false;
  let contasDoUsuario = []; // as contas do usuário (definirContas): a janela "Novo cartão" escolhe entre elas
  const avisoCartao = raiz.querySelector('#detalhe-cartao-aviso');
  const botaoCriarCartao = raiz.querySelector('#detalhe-cartao-criar');
  const areaCartao = raiz.querySelector('#detalhe-cartao-area');

  /**
   * O campo Cartão: aparece só com o pagamento Cartão de crédito e lista os cartões da conta escolhida ("nome | conta"). Mudar o pagamento ou
   * a conta refaz a lista. Troca só as <option>: o <select> tem dentro o <button><selectedcontent>.
   */
  function atualizarCartoes(escolhidoForcado) {
    const select = controles.cartaoId;
    const credito = controles.formaPagamento.value === 'credito';
    areaCartao.hidden = !credito || atual?.tipo === 'transferencia' || doBanco();
    if (areaCartao.hidden) {
      select.value = '';
      return;
    }
    const escolhido = escolhidoForcado ?? select.value; // ao abrir, vale o cartão da transação (a lista ainda estava vazia)
    const contaId = controles.contaId.value || atual?.contaId;
    for (const antiga of select.querySelectorAll('option')) antiga.remove();
    const daConta = cartoes.filter((c) => !c.contaId || c.contaId === contaId);
    // Toda compra no crédito precisa de um cartão: numa conta sem cartão a lista some e aparece o aviso com o botão que cria um (o mesmo do
    // formulário de lançamento). Os cartões só chegam depois de `definirCartoes`, então antes disso a lista não é trocada pelo aviso.
    const sem = cartoesCarregados && daConta.length === 0;
    areaCartao.classList.toggle('campo-cartao--sem', sem);
    avisoCartao.hidden = !sem;
    botaoCriarCartao.hidden = !sem;
    // uma transação antiga no crédito, sem cartão, mostra o convite a escolher um (não "Sem cartão": o crédito pede cartão)
    if (escolhido === '' && daConta.length > 0) select.add(new Option('Escolha o cartão', ''));
    for (const cartao of daConta) {
      const dona = cartao.conta ?? atual?.conta;
      const opcao = new Option(dona ? `${cartao.nome} | ${dona.nome} | ${dona.bancoNome}` : `${cartao.nome} | sem conta`, cartao.id);
      definirAvatar(opcao, { banco: dona?.banco, sigla: iniciais(cartao.nome), forma: 'quadrado', titulo: cartao.nome, subtitulo: dona ? `${dona.nome} · ${dona.bancoNome}` : 'sem conta', icone: cartao.icone, cor: cartao.cor });
      select.add(opcao);
    }
    select.value = [...select.options].some((o) => o.value === escolhido) ? escolhido : (select.options[0]?.value ?? '');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  let atual = null; // a transação aberta
  let original = null; // os valores dela, para saber o que mudou
  let ocupado = false;
  let rolagemTravada = false;
  let elementoAnterior = null;

  const travar = () => { if (!rolagemTravada) { travarRolagem(); rolagemTravada = true; } };
  const liberar = () => { if (rolagemTravada) { liberarRolagem(); rolagemTravada = false; } };

  function limparErros() {
    for (const nome of CAMPOS) {
      erros[nome].hidden = true;
      erros[nome].textContent = '';
      controles[nome].removeAttribute('aria-invalid');
    }
  }

  // numa transação do Open Finance só a descrição, a categoria e a meta se editam (os outros campos nem aparecem)
  const EDITAVEIS_DO_OPEN_FINANCE = ['descricao', 'categoria', 'metaId', 'observacoes'];
  const doBanco = () => atual?.origem === 'pluggy';

  function mudancas() {
    return CAMPOS.filter((nome) => (!doBanco() || EDITAVEIS_DO_OPEN_FINANCE.includes(nome)) && ler(nome) !== original[nome]);
  }

  function atualizarBotao() {
    botaoSalvar.hidden = !atual || mudancas().length === 0;
  }

  function preencher(t) {
    original = valoresDe(t);
    for (const nome of CAMPOS) escrever(nome, original[nome]);
    // uma opção que a lista não tem (meta que ainda não carregou, categoria desconhecida) não conta como alteração
    for (const nome of SELETORES_DE_LISTA) original[nome] = controles[nome].value;
    atualizarCartoes(t.cartaoId ?? '');
    original.cartaoId = controles.cartaoId.value; // uma opção que a lista não tem não conta como alteração
    textoDescricao.textContent = t.descricao;
    textoValor.textContent = numero.format(t.valor);
    const transferencia = t.tipo === 'transferencia';
    chipTipo.textContent = t.tipo === 'despesa' ? 'Despesa' : transferencia ? 'Transferência' : 'Receita';
    chipTipo.dataset.tipo = t.tipo;
    chipOrigem.textContent = transferencia
      ? `${t.conta?.nome ?? 'Conta'} → ${t.contaDestino?.nome ?? 'Conta'}`
      : (t.conta?.nome ?? (t.origem === 'pluggy' ? 'Open Finance' : 'Manual'));
    for (const nome of FORA_DA_TRANSFERENCIA) controles[nome].closest('.detalhe__linha').hidden = transferencia;
    // o importado fica na conta de onde veio; e uma compra no cartão fica na conta do cartão (não dá para pagar com o cartão de uma conta e lançar em outra)
    controles.contaId.disabled = t.origem === 'pluggy' || (t.formaPagamento === 'credito' && Boolean(t.cartaoId));
    // o que vem do Open Finance é do banco: só a descrição, a categoria e a meta se editam (o resto fica travado)
    // (esses campos nem aparecem no modo de edição: ver definirModo)
    for (const nome of ['valor', 'tipo', 'formaPagamento', 'cartaoId', 'data']) controles[nome].disabled = t.origem === 'pluggy';
    // transação do Open Finance: no modo de edição só aparecem a descrição, a categoria, a meta e a observação
    if (t.origem === 'pluggy') {
      for (const nome of ['valor', 'tipo', 'formaPagamento', 'contaId']) controles[nome].closest('.detalhe__linha').hidden = true;
      areaCartao.hidden = true;
    }

    const credito = t.formaPagamento === 'credito';
    // no crédito, a nota diz em qual cartão foi (e as parcelas)
    const nomeDoCartao = t.cartao ? ` ${t.cartao.nome}` : '';
    notaCredito.hidden = !credito;
    if (credito) {
      notaCredito.textContent = t.parcelas > 1
        ? `Compra em ${t.parcelas}x de ${formatarMoeda(t.valor / t.parcelas)} no cartão${nomeDoCartao}.`
        : `Compra à vista no cartão${nomeDoCartao}.`;
    }

    const manual = t.origem !== 'pluggy';
    botaoDuplicar.disabled = !manual; // só lançamentos manuais podem ser duplicados
    botaoDuplicar.dataset.dica = manual ? 'Duplicar com a data de hoje' : 'Transações importadas não podem ser duplicadas';
    limparErros();
    atualizarBotao();
  }

  /** Liga ou desliga a edição de todos os campos (ao abrir o painel, sempre começa só para ler: sem data e com a observação travada). */
  function definirModo(completo) {
    extras.hidden = !completo;
    // nada se edita até clicar em "Editar todos os campos": a data só aparece no modo de edição e a observação fica só para ler
    controles.data.closest('.detalhe__linha').hidden = !completo || doBanco(); // (e uma transação do Open Finance nem tem a data para editar)
    controles.observacoes.readOnly = !completo; // (a observação de uma transação do Open Finance se edita como a das outras)
    controles.observacoes.tabIndex = completo ? 0 : -1; // travada, sai da ordem do Tab
    controles.observacoes.placeholder = completo ? 'Adicione uma observação' : 'Sem observação';
    cabecalho.hidden = completo; // o título e o valor viram campos
    botaoModo.setAttribute('aria-expanded', String(completo));
    textoModo.textContent = completo ? 'Ocultar os campos' : 'Editar todos os campos';
  }
  botaoModo.addEventListener('click', () => definirModo(extras.hidden), { signal });

  function abrir(transacao) {
    atual = transacao;
    definirModo(false);
    preencher(transacao);
    elementoAnterior = document.activeElement;
    painel.removeAttribute('inert');
    painel.setAttribute('aria-hidden', 'false');
    painel.classList.add('detalhe--aberto');
    fundo.classList.add('detalhe-fundo--aberto');
    travar();
    raiz.querySelector('#detalhe-fechar').focus();
  }

  function fechar() {
    if (!painel.classList.contains('detalhe--aberto')) return;
    painel.classList.remove('detalhe--aberto');
    fundo.classList.remove('detalhe-fundo--aberto');
    painel.setAttribute('aria-hidden', 'true');
    painel.setAttribute('inert', '');
    liberar();
    atual = null;
    if (elementoAnterior?.isConnected) elementoAnterior.focus();
  }

  raiz.querySelector('#detalhe-fechar').addEventListener('click', fechar, { signal });
  fundo.addEventListener('click', fechar, { signal });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && painel.classList.contains('detalhe--aberto')) fechar();
  }, { signal });
  signal?.addEventListener('abort', liberar); // a classe da rolagem fica no <body>, que não é desmontado

  // O botão "Criar cartão para esta conta" abre a janela "Novo cartão" por cima do painel, já com a conta da transação. Quando o cartão é
  // criado, `cartaoCriado` (abaixo) o escolhe.
  // o botão do rodapé da lista de cartões faz o mesmo
  areaCartao.addEventListener('seletor:rodape', () => abrirCartaoRapido?.({ contaId: controles.contaId.value || atual?.contaId, contas: contasDoUsuario }), { signal });
  botaoCriarCartao.addEventListener('click', () => {
    abrirCartaoRapido?.({ contaId: controles.contaId.value || atual?.contaId, contas: contasDoUsuario });
  }, { signal });
  controles.formaPagamento.addEventListener('change', () => atualizarCartoes(), { signal });
  controles.contaId.addEventListener('change', () => atualizarCartoes(), { signal });
  formulario.addEventListener('input', atualizarBotao, { signal });
  formulario.addEventListener('change', atualizarBotao, { signal });
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    botaoSalvar.click();
  }, { signal });

  botaoSalvar.addEventListener('click', async () => {
    if (ocupado || !atual) return;
    limparErros();

    const alteracoes = {};
    let falhou = false;
    for (const nome of mudancas()) {
      const { erro, valor } = validarCampo(nome, ler(nome));
      if (erro) {
        falhou = true;
        erros[nome].textContent = erro;
        erros[nome].hidden = false;
        controles[nome].setAttribute('aria-invalid', 'true');
        tremer(controles[nome]);
      } else {
        alteracoes[nome] = valor;
      }
    }
    // Toda compra no crédito precisa de um cartão: passar uma transação para o crédito (ou mudar a conta) sem cartão não salva. Uma transação
    // antiga, que já era assim, continua podendo mudar outros campos.
    const mexeuNoCredito = mudancas().some((n) => ["formaPagamento", "contaId", "cartaoId"].includes(n));
    if (!doBanco() && atual.tipo !== "transferencia" && mexeuNoCredito && controles.formaPagamento.value === "credito" && !controles.cartaoId.value) {
      falhou = true;
      erros.cartaoId.textContent = "Crie ou escolha um cartão para lançar no crédito.";
      erros.cartaoId.hidden = false;
    }
    if (falhou) {
      notificar('Corrija os campos destacados.', 'erro');
      return;
    }

    ocupado = true;
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando...';
    try {
      await salvar(atual.id, alteracoes, atual);
      fechar();
    } catch {
      // a página já avisou o erro; o painel continua aberto para tentar de novo
    } finally {
      ocupado = false;
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar alterações';
    }
  }, { signal });

  botaoDuplicar.addEventListener('click', async () => {
    if (!atual || botaoDuplicar.disabled) return;
    const t = atual;
    try {
      await duplicar(t);
      fechar();
    } catch {
      // a página já avisou
    }
  }, { signal });

  botaoExcluir.addEventListener('click', async () => {
    if (!atual) return;
    const t = atual;
    try {
      if (await excluir(t)) fechar();
    } catch {
      // a página já avisou
    }
  }, { signal });

  return {
    abrir,
    fechar,

    /** Um cartão acabou de ser criado pela janela "Novo cartão" (e a lista já foi atualizada com `definirCartoes`): escolhe ele neste campo. */
    cartaoCriado(cartao) {
      const select = controles.cartaoId;
      if (![...select.options].some((o) => o.value === cartao.id)) return;
      select.value = cartao.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      atualizarBotao();
    },

    /** Põe os cartões do usuário no campo Cartão. */
    definirCartoes(lista) {
      cartoes = lista;
      cartoesCarregados = true;
      if (atual) atualizarCartoes();
    },

    /** Põe as contas do usuário na lista do campo Conta, mantendo a escolha atual. */
    definirContas(contas) {
      contasDoUsuario = contas;
      const select = controles.contaId;
      const escolhida = select.value;
      for (const opcao of [...select.options]) opcao.remove(); // o <button> do select fica
      for (const conta of contas.filter((c) => c.tipo === 'manual')) { const opcao = new Option(`${conta.nome} (${conta.bancoNome})`, conta.id); definirAvatar(opcao, { banco: conta.banco, sigla: iniciais(conta.nome), titulo: conta.nome, subtitulo: conta.bancoNome, icone: conta.icone, cor: conta.cor }); select.add(opcao); } // só se move para conta manual
      select.value = [...select.options].some((o) => o.value === escolhida) ? escolhida : '';
    },

    /** Põe as metas do usuário na lista do campo Meta, mantendo a escolha atual. */
    definirMetas(metas) {
      const select = controles.metaId;
      const escolhida = select.value;
      for (const opcao of [...select.options].slice(1)) opcao.remove(); // "Sem meta" e o <button> do select ficam
      for (const meta of metas) select.add(new Option(meta.titulo, meta.id));
      select.value = [...select.options].some((o) => o.value === escolhida) ? escolhida : '';
    },
  };
}
