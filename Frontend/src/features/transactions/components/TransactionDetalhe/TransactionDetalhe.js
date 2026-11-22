import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { aplicarMascaraMoeda } from '../../../../shared/components/campos.js';
import { notificar } from '../../../../shared/components/notificacao.js';
import { travarRolagem, liberarRolagem } from '../../../../shared/utils/rolagem.js';
import { valorParaCampo } from '../../../../shared/utils/moeda.js';
import { validarCampo } from '../../utils/formValidation.js';
import { formatarMoeda } from '../../utils/format.js';

// Os campos do painel: data e observação sempre à vista; os demais aparecem no modo "todos os campos"
const CAMPOS = ['descricao', 'valor', 'tipo', 'categoria', 'formaPagamento', 'metaId', 'data', 'observacoes'];
const SELETORES_DE_LISTA = ['tipo', 'categoria', 'formaPagamento', 'metaId']; // os que são listas (selects do projeto)
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
export function iniciarDetalhe(raiz, { salvar, duplicar, excluir, signal }) {
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

  function mudancas() {
    return CAMPOS.filter((nome) => ler(nome) !== original[nome]);
  }

  function atualizarBotao() {
    botaoSalvar.hidden = !atual || mudancas().length === 0;
  }

  function preencher(t) {
    original = valoresDe(t);
    for (const nome of CAMPOS) escrever(nome, original[nome]);
    // uma opção que a lista não tem (meta que ainda não carregou, categoria desconhecida) não conta como alteração
    for (const nome of SELETORES_DE_LISTA) original[nome] = controles[nome].value;
    textoDescricao.textContent = t.descricao;
    textoValor.textContent = numero.format(t.valor);
    chipTipo.textContent = t.tipo === 'despesa' ? 'Despesa' : 'Receita';
    chipTipo.dataset.tipo = t.tipo;
    chipOrigem.textContent = t.origem === 'pluggy' ? 'Open Finance' : 'Manual';

    const credito = t.formaPagamento === 'credito';
    notaCredito.hidden = !credito || !(t.parcelas > 1);
    if (!notaCredito.hidden) notaCredito.textContent = `Compra em ${t.parcelas}x de ${formatarMoeda(t.valor / t.parcelas)} no cartão.`;

    const manual = t.origem !== 'pluggy';
    botaoDuplicar.disabled = !manual; // só lançamentos manuais podem ser duplicados
    botaoDuplicar.dataset.dica = manual ? 'Duplicar com a data de hoje' : 'Transações importadas não podem ser duplicadas';
    limparErros();
    atualizarBotao();
  }

  /** Liga ou desliga a edição de todos os campos (ao abrir o painel, sempre começa só com data e observação). */
  function definirModo(completo) {
    extras.hidden = !completo;
    cabecalho.hidden = completo; // o título e o valor viram campos
    botaoModo.setAttribute('aria-expanded', String(completo));
    textoModo.textContent = completo ? 'Editar só a data e a observação' : 'Editar todos os campos';
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
      } else {
        alteracoes[nome] = valor;
      }
    }
    if (falhou) {
      notificar('Corrija os campos destacados.', 'erro');
      return;
    }

    ocupado = true;
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando...';
    try {
      await salvar(atual.id, alteracoes);
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
