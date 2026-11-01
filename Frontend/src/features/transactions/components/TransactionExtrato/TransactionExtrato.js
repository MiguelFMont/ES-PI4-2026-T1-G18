import { confirmar, notificar } from '../../../../shared/components/notificacao.js';
import { formatarData, formatarMoeda } from '../../utils/format.js';
import { CATEGORIAS, FORMAS_PAGAMENTO, TIPOS, rotuloDe } from '../../utils/constants.js';
import { aplicarMascaraMoeda } from '../../../../shared/components/campos.js';
import { validarCampo } from '../../utils/formValidation.js';
import { iniciarEdicao, valorParaEditar } from './EdicaoCelula.js';

// Campos que a edição em lote pode mudar, na ordem do formulário (vazio ou "Manter" não muda).
const CAMPOS_LOTE = ['descricao', 'tipo', 'valor', 'data', 'categoria', 'formaPagamento', 'observacoes'];

const ROTULOS_CAMPO = {
  data: 'data',
  descricao: 'descrição',
  observacoes: 'observações',
  categoria: 'categoria',
  formaPagamento: 'pagamento',
  tipo: 'tipo',
  valor: 'valor',
};

/**
 * Liga a lógica à área do extrato (HTML em TransactionExtrato.html). O HTML já tem a contagem, a lista e a
 * paginação; aqui só se escolhe qual estado mostrar e se preenchem os dados.
 *   irParaPagina(numero), tentarNovamente() e mudarLimite(quantidade) são chamados pelos controles da área;
 *   Editar um campo da linha não chama o Backend: a alteração fica num rascunho (o campo ganha um anel) e a barra
 *   "Alterações pendentes" aparece. Ao confirmar, salvarAlteracoes(itens) envia tudo numa chamada em lote.
 *   salvarAlteracoes(itens), editarVarias(transacoes, mudancas) e excluirVarias(transacoes) devolvem uma Promise,
 *   avisam o resultado e atualizam a lista; se falharem, a área mantém o que o usuário estava fazendo.
 */
export function iniciarExtrato(raiz, { irParaPagina, tentarNovamente, mudarLimite, salvarAlteracoes, editarVarias, excluirVarias }) {
  const area = raiz.querySelector('#transactions-extrato');
  const carregando = raiz.querySelector('#extrato-carregando');
  const erro = raiz.querySelector('#extrato-erro');
  const conteudo = raiz.querySelector('#extrato-conteudo');
  const vazio = raiz.querySelector('#extrato-vazio');
  const lista = raiz.querySelector('#extrato-lista');
  const linhas = raiz.querySelector('#extrato-linhas');
  const modeloLinha = raiz.querySelector('#modelo-linha-extrato');
  const anterior = raiz.querySelector('#pagina-anterior');
  const proxima = raiz.querySelector('#pagina-proxima');
  const limite = raiz.querySelector('#extrato-limite');
  const barra = raiz.querySelector('#extrato-selecao');
  const selecionarTodas = raiz.querySelector('#extrato-selecionar-todas');
  const botaoEditarVarias = raiz.querySelector('#extrato-editar-varias');
  const edicaoLote = raiz.querySelector('#extrato-edicao-lote');
  const barraPendentes = raiz.querySelector('#extrato-pendentes');
  const botaoConfirmar = raiz.querySelector('#extrato-confirmar-alteracoes');
  const botaoDescartar = raiz.querySelector('#extrato-descartar-alteracoes');
  let paginaAtual = 1;
  let itens = []; // as transações que estão na tela
  const selecionadas = new Set(); // ids marcados
  const rascunho = new Map(); // id -> { campo: valor }: alterações ainda não enviadas (valores no formato da API)

  // ---- rascunho de alterações ----

  const efetiva = (transacao) => ({ ...transacao, ...rascunho.get(transacao.id) });
  const camposAlterados = (transacao) => new Set(Object.keys(rascunho.get(transacao.id) ?? {}));
  const valorOriginal = (campo, transacao) => validarCampo(campo, valorParaEditar(campo, transacao)).valor;

  // Atualiza a linha no lugar (sem trocar os botões), para um clique em outro campo não se perder.
  function redesenharLinha(transacao) {
    const linha = linhas.querySelector(`tr[data-id="${CSS.escape(transacao.id)}"]`);
    if (linha) preencherLinha(linha, efetiva(transacao), camposAlterados(transacao));
  }

  function atualizarPendentes() {
    let alteracoes = 0;
    for (const campos of rascunho.values()) alteracoes += Object.keys(campos).length;
    barraPendentes.hidden = alteracoes === 0;
    raiz.querySelector('#extrato-pendentes-texto').textContent =
      `${alteracoes} ${alteracoes === 1 ? 'alteração pendente' : 'alterações pendentes'} em ` +
      `${rascunho.size} ${rascunho.size === 1 ? 'transação' : 'transações'}`;
  }

  function registrarAlteracao(transacao, campo, valor) {
    const campos = { ...rascunho.get(transacao.id) };
    // voltar ao valor original desfaz a alteração daquele campo
    if (String(valor) === String(valorOriginal(campo, transacao))) delete campos[campo];
    else campos[campo] = valor;
    if (Object.keys(campos).length > 0) rascunho.set(transacao.id, campos);
    else rascunho.delete(transacao.id);
    redesenharLinha(transacao);
    atualizarPendentes();
  }

  // Depois de recarregar a lista, tira do rascunho o que já é igual ao que está salvo (alterações recém-confirmadas).
  function podarRascunho() {
    for (const [id, campos] of rascunho) {
      const transacao = itens.find((t) => t.id === id);
      if (!transacao) continue; // está em outra página ou filtro: continua pendente
      for (const campo of Object.keys(campos)) {
        if (String(campos[campo]) === String(valorOriginal(campo, transacao))) delete campos[campo];
      }
      if (Object.keys(campos).length === 0) rascunho.delete(id);
    }
  }

  botaoDescartar.addEventListener('click', () => {
    rascunho.clear();
    for (const transacao of itens) redesenharLinha(transacao);
    atualizarPendentes();
  });

  botaoConfirmar.addEventListener('click', async () => {
    const lote = [...rascunho].map(([id, alteracoes]) => ({ id, alteracoes }));
    botaoConfirmar.disabled = true;
    botaoDescartar.disabled = true;
    try {
      const { naoEncontradas } = await salvarAlteracoes(lote);
      for (const id of naoEncontradas) rascunho.delete(id); // não existem mais: não adianta tentar de novo
      podarRascunho();
      for (const transacao of itens) redesenharLinha(transacao);
      atualizarPendentes();
    } catch {
      // quem chamou já avisou o erro; o rascunho fica para tentar de novo
    } finally {
      botaoConfirmar.disabled = false;
      botaoDescartar.disabled = false;
    }
  });

  anterior.addEventListener('click', () => irParaPagina(paginaAtual - 1));
  proxima.addEventListener('click', () => irParaPagina(paginaAtual + 1));
  raiz.querySelector('#extrato-tentar-novamente').addEventListener('click', tentarNovamente);
  limite.addEventListener('change', () => mudarLimite(Number(limite.value)));

  function mostrar(estado) {
    carregando.hidden = estado !== 'carregando';
    erro.hidden = estado !== 'erro';
    conteudo.hidden = estado !== 'conteudo';
  }

  // ---- seleção e ações em lote ----

  const marcadas = () => itens.filter((t) => selecionadas.has(t.id));

  function atualizarSelecao() {
    const quantidade = selecionadas.size;
    barra.hidden = quantidade === 0;
    raiz.querySelector('#extrato-selecao-texto').textContent =
      `${quantidade} ${quantidade === 1 ? 'selecionada' : 'selecionadas'}`;
    selecionarTodas.checked = itens.length > 0 && quantidade === itens.length;
    selecionarTodas.indeterminate = quantidade > 0 && quantidade < itens.length;
    if (quantidade === 0) alternarEdicaoLote(false);
    for (const linha of linhas.children) {
      const marcada = selecionadas.has(linha.dataset.id);
      linha.classList.toggle('transactions-linha--selecionada', marcada);
      linha.querySelector('[data-selecao]').checked = marcada;
    }
  }

  function alternarEdicaoLote(abrir) {
    edicaoLote.hidden = !abrir;
    botaoEditarVarias.setAttribute('aria-expanded', String(abrir));
    if (!abrir) {
      edicaoLote.reset();
      limparErrosLote();
    }
  }

  function mostrarErroLote(campo, mensagem) {
    const controle = edicaoLote.elements[campo];
    const texto = edicaoLote.querySelector(`#lote-${campo}-erro`);
    controle.setAttribute('aria-invalid', 'true');
    if (!texto) return;
    controle.setAttribute('aria-describedby', texto.id);
    texto.textContent = mensagem;
    texto.hidden = false;
  }

  function limparErrosLote() {
    for (const controle of edicaoLote.elements) controle.removeAttribute?.('aria-invalid');
    for (const texto of edicaoLote.querySelectorAll('.campo__erro')) {
      texto.hidden = true;
      texto.textContent = '';
    }
  }

  aplicarMascaraMoeda(edicaoLote.elements.valor); // o valor já aparece formatado (1 -> 0,01)

  function ocupado(estaOcupado) {
    area.classList.toggle('transactions-extrato--carregando', estaOcupado);
    for (const botao of barra.querySelectorAll('button')) botao.disabled = estaOcupado;
  }

  selecionarTodas.addEventListener('change', () => {
    if (selecionarTodas.checked) for (const t of itens) selecionadas.add(t.id);
    else selecionadas.clear();
    atualizarSelecao();
  });
  linhas.addEventListener('change', (evento) => {
    if (!evento.target.matches('[data-selecao]')) return;
    const id = evento.target.closest('tr').dataset.id;
    if (evento.target.checked) selecionadas.add(id);
    else selecionadas.delete(id);
    atualizarSelecao();
  });
  raiz.querySelector('#extrato-limpar-selecao').addEventListener('click', () => {
    selecionadas.clear();
    atualizarSelecao();
  });
  botaoEditarVarias.addEventListener('click', () => alternarEdicaoLote(edicaoLote.hidden));

  edicaoLote.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErrosLote();
    const mudancas = {};
    const erros = {};
    for (const campo of CAMPOS_LOTE) {
      const bruto = edicaoLote.elements[campo].value.trim();
      if (!bruto) continue; // vazio ou "Manter": não muda
      const { erro, valor } = validarCampo(campo, bruto);
      if (erro) erros[campo] = erro;
      else mudancas[campo] = valor;
    }
    if (Object.keys(erros).length > 0) {
      for (const [campo, mensagem] of Object.entries(erros)) mostrarErroLote(campo, mensagem);
      notificar('Corrija os campos destacados.', 'erro');
      return;
    }
    if (Object.keys(mudancas).length === 0) {
      notificar('Preencha ou escolha o que alterar.', 'erro');
      return;
    }
    ocupado(true);
    try {
      await editarVarias(marcadas(), mudancas);
    } finally {
      ocupado(false);
    }
  });

  raiz.querySelector('#extrato-excluir-varias').addEventListener('click', async () => {
    const quantidade = selecionadas.size;
    const confirmou = await confirmar(
      quantidade === 1
        ? 'Excluir a transação selecionada? Não dá para desfazer.'
        : `Excluir as ${quantidade} transações selecionadas? Não dá para desfazer.`,
      'erro'
    );
    if (!confirmou) return;

    const excluidas = marcadas();
    ocupado(true);
    try {
      await excluirVarias(excluidas);
      for (const transacao of excluidas) rascunho.delete(transacao.id); // não faz sentido alterar o que foi excluído
      atualizarPendentes();
    } finally {
      ocupado(false);
    }
  });

  // ---- edição de um campo ao clicar ----

  linhas.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-campo]');
    if (!botao) return;
    const transacao = itens.find((t) => t.id === botao.closest('tr').dataset.id);
    const campo = botao.dataset.campo;
    iniciarEdicao({
      botao,
      campo,
      atual: valorParaEditar(campo, efetiva(transacao)), // mostra a alteração pendente, se houver
      aoSalvar: async (valor) => registrarAlteracao(transacao, campo, valor), // só marca na tela; o envio é na confirmação
    });
  });

  return {
    /** Há alterações marcadas na tela que ainda não foram confirmadas? */
    temPendencias: () => rascunho.size > 0,

    /** Início de uma consulta. Se já há dados na tela, eles ficam (esmaecidos) até a resposta chegar. */
    iniciarCarga() {
      area.setAttribute('aria-busy', 'true');
      if (conteudo.hidden) mostrar('carregando');
      else area.classList.add('transactions-extrato--carregando');
    },

    finalizarCarga() {
      area.removeAttribute('aria-busy');
      area.classList.remove('transactions-extrato--carregando');
    },

    mostrarResposta(resposta, { temFiltros }) {
      paginaAtual = resposta.pagina;
      itens = resposta.itens;
      selecionadas.clear();
      podarRascunho();
      raiz.querySelector('#extrato-contagem').textContent =
        `${resposta.total} ${resposta.total === 1 ? 'transação' : 'transações'}`;
      limite.value = String(resposta.limite);

      vazio.hidden = resposta.total > 0;
      lista.hidden = resposta.total === 0;
      if (resposta.total === 0) {
        vazio.textContent = temFiltros
          ? 'Nenhuma transação encontrada com esses filtros.'
          : 'Você ainda não tem transações. Use o botão "Nova transação" para cadastrar a primeira.';
      } else {
        linhas.replaceChildren(...itens.map((t) => montarLinha(modeloLinha, efetiva(t), camposAlterados(t))));
        raiz.querySelector('#pagina-info').textContent = `Página ${resposta.pagina} de ${resposta.totalPaginas}`;
        anterior.disabled = resposta.pagina <= 1;
        proxima.disabled = resposta.pagina >= resposta.totalPaginas;
      }
      atualizarSelecao();
      atualizarPendentes();
      mostrar('conteudo');
    },

    mostrarErro(falha) {
      // Falha de rede já vem com mensagem amigável do api.js; os demais erros ganham um texto genérico.
      raiz.querySelector('#extrato-erro-texto').textContent = falha?.status
        ? 'Não foi possível carregar as transações.'
        : (falha?.message ?? 'Erro inesperado.');
      mostrar('erro');
    },
  };
}

/** Uma linha da tabela, copiada do <template> do HTML. Os textos entram por textContent, nunca como HTML. */
function montarLinha(modelo, transacao, alterados = new Set()) {
  const linha = modelo.content.firstElementChild.cloneNode(true);
  linha.dataset.id = transacao.id;
  for (const botao of linha.querySelectorAll('button[data-campo]')) botao.dataset.rotulo = ROTULOS_CAMPO[botao.dataset.campo];
  linha.querySelector('[data-selecao]').setAttribute('aria-label', `Selecionar ${transacao.descricao}`);
  preencherLinha(linha, transacao, alterados);
  return linha;
}

/** Escreve os dados da transação nos campos de uma linha (nova ou já na tela). `alterados` são os campos com alteração pendente. */
function preencherLinha(linha, transacao, alterados = new Set()) {
  const receita = transacao.tipo === 'receita';

  const textos = {
    data: formatarData(transacao.data),
    descricao: transacao.descricao,
    observacoes: transacao.observacoes ?? '',
    categoria: rotuloDe(CATEGORIAS, transacao.categoria),
    formaPagamento: rotuloDe(FORMAS_PAGAMENTO, transacao.formaPagamento),
    tipo: rotuloDe(TIPOS, transacao.tipo),
    // o sinal e a coluna Tipo dizem se é receita ou despesa; a cor só reforça
    valor: `${receita ? '+' : '−'} ${formatarMoeda(transacao.valor)}`,
  };

  for (const botao of linha.querySelectorAll('button[data-campo]')) {
    const campo = botao.dataset.campo;
    const pendente = alterados.has(campo);
    botao.textContent = textos[campo] || 'Observações'; // só as observações podem estar vazias (aparece como dica)
    botao.setAttribute(
      'aria-label',
      `Editar ${ROTULOS_CAMPO[campo]}${textos[campo] ? `: ${textos[campo]}` : ''}${pendente ? ' (alteração pendente)' : ''}`
    );
    botao.title = pendente ? 'Alteração pendente: confirme para salvar' : 'Clique para editar';
    botao.classList.toggle('extrato-celula--vazia', !textos[campo]);
    botao.classList.toggle('extrato-celula--alterada', pendente);
  }

  const valor = linha.querySelector('.transactions-valor');
  valor.classList.toggle('transactions-valor--receita', receita);
  valor.classList.toggle('transactions-valor--despesa', !receita);
}
