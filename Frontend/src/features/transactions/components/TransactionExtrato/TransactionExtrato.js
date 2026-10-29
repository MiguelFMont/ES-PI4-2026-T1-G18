import { confirmar, notificar } from '../../../../shared/components/notificacao.js';
import { formatarData, formatarMoeda } from '../../utils/format.js';
import { CATEGORIAS, FORMAS_PAGAMENTO, TIPOS, rotuloDe } from '../../utils/constants.js';
import { iniciarEdicao, valorParaEditar } from './EdicaoCelula.js';

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
 *   editarCampo(transacao, campo, valor), editarVarias(transacoes, mudancas) e excluirVarias(transacoes) fazem a
 *   alteração (Promise) e atualizam a lista; se falharem, a área mantém o que o usuário estava fazendo.
 */
export function iniciarExtrato(raiz, { irParaPagina, tentarNovamente, mudarLimite, editarCampo, editarVarias, excluirVarias }) {
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
  let paginaAtual = 1;
  let itens = []; // as transações que estão na tela
  const selecionadas = new Set(); // ids marcados

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
    if (!abrir) edicaoLote.reset();
  }

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
    const mudancas = {};
    for (const campo of ['categoria', 'formaPagamento']) {
      if (edicaoLote.elements[campo].value) mudancas[campo] = edicaoLote.elements[campo].value;
    }
    if (Object.keys(mudancas).length === 0) {
      notificar('Escolha o que alterar.', 'erro');
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

    ocupado(true);
    try {
      await excluirVarias(marcadas());
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
      atual: valorParaEditar(campo, transacao),
      aoSalvar: (valor) => editarCampo(transacao, campo, valor),
    });
  });

  return {
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
        linhas.replaceChildren(...itens.map((t) => montarLinha(modeloLinha, t)));
        raiz.querySelector('#pagina-info').textContent = `Página ${resposta.pagina} de ${resposta.totalPaginas}`;
        anterior.disabled = resposta.pagina <= 1;
        proxima.disabled = resposta.pagina >= resposta.totalPaginas;
      }
      atualizarSelecao();
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
function montarLinha(modelo, transacao) {
  const linha = modelo.content.firstElementChild.cloneNode(true);
  const receita = transacao.tipo === 'receita';
  linha.dataset.id = transacao.id;

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
    const rotulo = ROTULOS_CAMPO[campo];
    botao.dataset.rotulo = rotulo;
    botao.textContent = textos[campo] || 'Observações'; // só as observações podem estar vazias (aparece como dica)
    botao.setAttribute('aria-label', `Editar ${rotulo}${textos[campo] ? `: ${textos[campo]}` : ''}`);
    botao.title = 'Clique para editar';
    if (!textos[campo]) botao.classList.add('extrato-celula--vazia');
  }
  linha.querySelector('[data-selecao]').setAttribute('aria-label', `Selecionar ${transacao.descricao}`);
  linha.querySelector('.transactions-valor').classList.add(`transactions-valor--${receita ? 'receita' : 'despesa'}`);
  return linha;
}
