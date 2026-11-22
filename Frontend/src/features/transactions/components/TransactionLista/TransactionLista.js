import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { aplicarMascaraMoeda } from '../../../../shared/components/campos.js';
import { valorParaCampo } from '../../../../shared/utils/moeda.js';
import { CATEGORIAS, FORMAS_PAGAMENTO, TIPOS, corDe, rotuloDe } from '../../utils/constants.js';
import { dataDeHoje, formatarMoeda } from '../../utils/format.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const numeroBr = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2026-11-20" -> "Hoje", "Ontem" ou "20 de novembro". */
function tituloDoDia(dia) {
  const hoje = dataDeHoje();
  const ontem = new Date(`${hoje}T00:00:00Z`);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  if (dia === hoje) return 'Hoje';
  if (dia === ontem.toISOString().slice(0, 10)) return 'Ontem';
  const [ano, mes, numero] = dia.split('-').map(Number);
  const anoAtual = Number(hoje.slice(0, 4));
  return `${numero} de ${MESES[mes - 1]}${ano === anoAtual ? '' : ` de ${ano}`}`;
}

/** Valor com sinal e sem o símbolo da moeda: despesa "-1.000,00", receita "+5.000,00". */
function valorComSinal(transacao) {
  return `${transacao.tipo === 'despesa' ? '-' : '+'}${numeroBr.format(transacao.valor)}`;
}

const origemDe = (transacao) => (transacao.origem === 'pluggy' ? 'Open Finance' : 'Manual');

/**
 * Liga a lista (HTML em TransactionLista.html). Guarda as transações já carregadas (a página pede mais com "Carregar mais"),
 * agrupa por dia e desenha cada linha a partir do <template>. Todo texto da API entra com textContent. Callbacks: `abrirDetalhe(transacao)`, `carregarMais()`, `tentarNovamente()`,
 * `editarCampo(transacao, campo, texto)` (edição ao clicar num campo da linha) e `alterarVarias(transacoes, mudancas)` (a barra escura): os
 * dois só validam e chamam `rascunhar`, que marca a alteração na tela; `confirmarPendentes(lote, inverso)` envia tudo quando o usuário confirma (`inverso` desfaz o lote);
 * `duplicarVarias(transacoes)` e `excluirVarias(transacoes)`. `definirMetas(metas)` dá os títulos da coluna Meta.
 * Devolve { iniciarCarga, mostrarResposta(resposta, { acrescentar }), mostrarErro(erro), definirSelecao(ativo) }.
 */
export function iniciarLista(raiz, { abrirDetalhe, carregarMais, tentarNovamente, editarCampo, alterarVarias, confirmarPendentes, duplicarVarias, excluirVarias, signal }) {
  const secao = raiz.querySelector('#lista');
  const carregando = raiz.querySelector('#lista-carregando');
  const erro = raiz.querySelector('#lista-erro');
  const erroTexto = raiz.querySelector('#lista-erro-texto');
  const vazio = raiz.querySelector('#lista-vazio');
  const conteudo = raiz.querySelector('#lista-conteudo');
  const grupos = raiz.querySelector('#lista-grupos');
  const botaoMais = raiz.querySelector('#lista-mais');
  const barraSelecao = raiz.querySelector('#lista-selecao');
  const textoSelecao = raiz.querySelector('#lista-selecao-texto');
  const totalSelecao = raiz.querySelector('#lista-selecao-total');
  const areaTodas = raiz.querySelector('#lista-todas-area');
  const caixaTodas = raiz.querySelector('#lista-todas');
  const textoTodas = raiz.querySelector('#lista-todas-texto');
  const modeloDia = raiz.querySelector('#modelo-dia');
  const modeloLinha = raiz.querySelector('#modelo-transacao-linha');

  let itens = [];
  let selecionando = false;
  let metas = []; // as metas do usuário: título da coluna Meta e opções da edição
  // Alterações pendentes: id da transação -> { campo: valor novo }. Aparecem na tela como se já valessem e só vão para a API ao confirmar.
  const rascunho = new Map();
  const efetiva = (t) => ({ ...t, ...rascunho.get(t.id) });
  const valorOriginal = (t, nome) => (nome === 'metaId' ? (t.metaId ?? null) : nome === 'data' ? t.data.slice(0, 10) : t[nome]);
  const marcadas = new Set();

  function estado(qual) {
    carregando.hidden = qual !== 'carregando';
    erro.hidden = qual !== 'erro';
    vazio.hidden = qual !== 'vazio';
    conteudo.hidden = qual !== 'lista';
  }

  const campo = (linha, nome) => linha.querySelector(`[data-campo="${nome}"]`);

  function criarLinha(original) {
    const t = efetiva(original);
    const pendente = rascunho.get(original.id) ?? {};
    const linha = modeloLinha.content.firstElementChild.cloneNode(true);
    linha.dataset.id = t.id;
    linha.classList.toggle('linha--marcada', marcadas.has(t.id));
    linha.querySelector('.linha__marca').checked = marcadas.has(t.id);

    for (const nome of Object.keys(pendente)) {
      // a célula com alteração pendente ganha uma marca (descrição, categoria, pagamento, meta ou valor)
      const celula = linha.querySelector(`[data-editavel="${nome}"]`);
      celula?.classList.add('celula--pendente');
    }

    campo(linha, 'descricao').textContent = t.descricao;
    if (t.parcelas > 1) {
      const etiqueta = campo(linha, 'etiqueta');
      etiqueta.hidden = false;
      etiqueta.textContent = `${t.parcelas}x`;
    }
    const celulaTipo = campo(linha, 'tipo');
    celulaTipo.textContent = rotuloDe(TIPOS, t.tipo);
    celulaTipo.dataset.cor = corDe(TIPOS, t.tipo);
    const celulaCategoria = campo(linha, 'categoria');
    celulaCategoria.textContent = rotuloDe(CATEGORIAS, t.categoria);
    celulaCategoria.dataset.cor = corDe(CATEGORIAS, t.categoria);
    const celulaPagamento = campo(linha, 'pagamento');
    celulaPagamento.textContent = rotuloDe(FORMAS_PAGAMENTO, t.formaPagamento);
    celulaPagamento.dataset.cor = corDe(FORMAS_PAGAMENTO, t.formaPagamento);
    const celulaMeta = campo(linha, 'meta');
    celulaMeta.textContent = t.metaId ? (metas.find((m) => m.id === t.metaId)?.titulo ?? 'Meta') : 'Sem meta';
    celulaMeta.classList.toggle('celula--vazia', !t.metaId);
    celulaMeta.dataset.cor = t.metaId ? 'destaque2' : 'cinza';
    const celulaOrigem = campo(linha, 'conta');
    celulaOrigem.textContent = origemDe(t);
    celulaOrigem.dataset.cor = t.origem === 'pluggy' ? 'destaque' : 'cinza';
    const valor = campo(linha, 'valor');
    valor.textContent = valorComSinal(t);
    valor.classList.toggle('linha__valor--receita', t.tipo === 'receita');
    linha.setAttribute('aria-label', `${t.descricao}, ${t.tipo === 'despesa' ? 'despesa' : 'receita'} de ${formatarMoeda(t.valor)}`);
    return linha;
  }

  function desenhar() {
    // agrupa por dia (a lista já vem do mais recente para o mais antigo)
    const porDia = new Map();
    for (const t of itens) {
      const dia = t.data.slice(0, 10);
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push(t);
    }
    const blocos = [];
    for (const [dia, doDia] of porDia) {
      const bloco = modeloDia.content.firstElementChild.cloneNode(true);
      bloco.querySelector('[data-campo="titulo"]').textContent = tituloDoDia(dia);
      bloco.querySelector('.dia__lista').replaceChildren(...doDia.map(criarLinha));
      blocos.push(bloco);
    }
    grupos.replaceChildren(...blocos);
  }

  function atualizarBarraSelecao() {
    barraSelecao.hidden = !selecionando || marcadas.size === 0;
    areaTodas.hidden = !selecionando || itens.length === 0;
    const todas = itens.length > 0 && marcadas.size === itens.length;
    caixaTodas.checked = marcadas.size > 0;
    caixaTodas.indeterminate = marcadas.size > 0 && !todas;
    textoTodas.textContent = marcadas.size > 0 ? 'Limpar seleção' : 'Selecionar todas';
    textoSelecao.textContent = `${marcadas.size} ${marcadas.size === 1 ? 'selecionado' : 'selecionados'}`;

    // a soma das marcadas, com sinal (despesa negativa) e na cor do resultado
    const soma = itens.filter((t) => marcadas.has(t.id)).map(efetiva).reduce((total, t) => total + (t.tipo === 'despesa' ? -t.valor : t.valor), 0);
    totalSelecao.textContent = `R$ ${numeroBr.format(soma)}`;
    totalSelecao.classList.toggle('selecao__total--positivo', soma >= 0);
  }

  function marcarTodas(marcar) {
    marcadas.clear();
    if (marcar) for (const t of itens) marcadas.add(t.id);
    for (const linha of grupos.querySelectorAll('.linha')) {
      const marcada = marcadas.has(linha.dataset.id);
      linha.classList.toggle('linha--marcada', marcada);
      linha.querySelector('.linha__marca').checked = marcada;
    }
    atualizarBarraSelecao();
  }

  function alternarMarca(id) {
    if (marcadas.has(id)) marcadas.delete(id);
    else marcadas.add(id);
    const linha = grupos.querySelector(`[data-id="${id}"]`);
    linha?.classList.toggle('linha--marcada', marcadas.has(id));
    if (linha) linha.querySelector('.linha__marca').checked = marcadas.has(id);
    atualizarBarraSelecao();
  }

  // ---------------------------------------------------------------- edição ao clicar num campo da linha
  let editando = null; // { celula, fechar }

  function terminarEdicao() {
    editando?.fechar();
    editando = null;
  }

  function opcoesDe(campoDaApi) {
    if (campoDaApi === 'tipo') return TIPOS;
    if (campoDaApi === 'categoria') return CATEGORIAS;
    if (campoDaApi === 'formaPagamento') return FORMAS_PAGAMENTO;
    return [{ valor: '', rotulo: 'Sem meta' }, ...metas.map((m) => ({ valor: m.id, rotulo: m.titulo }))];
  }

  async function confirmar(transacao, campoDaApi, texto) {
    terminarEdicao();
    await editarCampo(transacao, campoDaApi, texto); // a página valida, salva e recarrega; em caso de erro, a linha volta como estava
  }

  function editarNaLinha(celula, original) {
    terminarEdicao();
    const transacao = efetiva(original); // o que está na tela (com as alterações pendentes)
    const campoDaApi = celula.dataset.editavel;

    if (campoDaApi === 'descricao' || campoDaApi === 'valor') {
      const entrada = document.createElement('input');
      entrada.type = 'text';
      entrada.className = 'celula__entrada';
      entrada.setAttribute('aria-label', campoDaApi === 'valor' ? 'Valor' : 'Descrição');
      if (campoDaApi === 'valor') {
        entrada.inputMode = 'decimal';
        aplicarMascaraMoeda(entrada);
        entrada.value = valorParaCampo(transacao.valor);
      } else {
        entrada.maxLength = 200;
        entrada.value = transacao.descricao;
      }
      const original = entrada.value;
      const conteudo = [...celula.childNodes];
      celula.replaceChildren(entrada);
      celula.classList.add('celula--editando');
      entrada.focus();
      entrada.select();

      let encerrada = false;
      const restaurar = () => {
        celula.classList.remove('celula--editando');
        celula.replaceChildren(...conteudo);
      };
      const encerrar = (salvar) => {
        if (encerrada) return;
        encerrada = true;
        const texto = entrada.value;
        restaurar();
        editando = null;
        if (salvar && texto !== original) editarCampo(transacao, campoDaApi, texto);
      };
      entrada.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter') encerrar(true);
        else if (evento.key === 'Escape') encerrar(false);
        evento.stopPropagation();
      });
      entrada.addEventListener('blur', () => encerrar(true));
      editando = { celula, fechar: () => encerrar(false) };
      return;
    }

    // categoria, pagamento e meta: uma lista pequena embaixo do campo
    const menu = document.createElement('div');
    menu.className = 'celula__menu';
    menu.setAttribute('role', 'listbox');
    const atual = campoDaApi === 'metaId' ? (transacao.metaId ?? '') : transacao[campoDaApi];
    menu.replaceChildren(...opcoesDe(campoDaApi).map((opcao) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'celula__opcao';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(opcao.valor === atual));
      item.dataset.valor = opcao.valor;
      if (opcao.cor) item.dataset.cor = opcao.cor;
      item.textContent = opcao.rotulo;
      return item;
    }));
    menu.addEventListener('click', (evento) => {
      const item = evento.target.closest('.celula__opcao');
      if (!item) return;
      evento.stopPropagation();
      const valor = item.dataset.valor;
      terminarEdicao();
      if (valor !== atual) editarCampo(transacao, campoDaApi, valor);
    });
    // o texto da célula vai para um <span> que continua cortado com reticências: sem isso, editando (a célula deixa o overflow
    // visível para a lista aparecer) o nome comprido passaria por cima da coluna ao lado
    const texto = document.createElement('span');
    texto.className = 'celula__texto';
    texto.append(...celula.childNodes);
    celula.classList.add('celula--editando');
    celula.append(texto, menu);
    menu.querySelector('[aria-selected="true"]')?.focus();
    editando = {
      celula,
      fechar: () => {
        menu.remove();
        texto.replaceWith(...texto.childNodes);
        celula.classList.remove('celula--editando');
      },
    };
  }

  document.addEventListener('click', (evento) => {
    // o caminho do evento (e não o alvo): ao começar a editar, o texto clicado sai do DOM e o alvo deixa de estar na célula
    if (editando && !evento.composedPath().includes(editando.celula)) terminarEdicao();
  }, { signal });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') terminarEdicao();
  }, { signal });

  function aoAtivar(linha) {
    const transacao = itens.find((t) => t.id === linha.dataset.id);
    if (!transacao) return;
    if (selecionando) alternarMarca(transacao.id);
    else abrirDetalhe(transacao);
  }

  grupos.addEventListener('click', (evento) => {
    const linha = evento.target.closest('.linha');
    if (!linha) return;
    // clicar num campo editável edita só ele; clicar no resto da linha abre os detalhes (ou marca, no modo Selecionar)
    const celula = evento.target.closest('[data-editavel]');
    if (celula && !selecionando) {
      const transacao = itens.find((t) => t.id === linha.dataset.id);
      if (transacao && !celula.classList.contains('celula--editando')) editarNaLinha(celula, transacao);
      return;
    }
    aoAtivar(linha);
  }, { signal });
  grupos.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const linha = evento.target.closest('.linha');
    if (!linha) return;
    evento.preventDefault();
    aoAtivar(linha);
  }, { signal });

  raiz.querySelector('#lista-tentar-novamente').addEventListener('click', () => tentarNovamente(), { signal });
  botaoMais.addEventListener('click', () => carregarMais(), { signal });

  const marcadasComoLista = () => itens.filter((t) => marcadas.has(t.id));
  raiz.querySelector('#lista-duplicar').addEventListener('click', () => duplicarVarias(marcadasComoLista()), { signal });
  raiz.querySelector('#lista-excluir').addEventListener('click', () => excluirVarias(marcadasComoLista()), { signal });
  raiz.querySelector('#lista-limpar').addEventListener('click', () => marcarTodas(false), { signal });
  caixaTodas.addEventListener('change', () => marcarTodas(caixaTodas.checked), { signal });
  // "Limpar seleção" (com algo marcado) desmarca tudo; com nada marcado, o mesmo clique marca todas
  areaTodas.addEventListener('click', (evento) => {
    if (evento.target === caixaTodas) return;
    evento.preventDefault();
    marcarTodas(marcadas.size === 0);
  }, { signal });

  // Trocar a descrição ou o valor de todas as marcadas: dois botões na barra escura, cada um com o seu campo
  const edicoes = ['descricao', 'valor'].map((nome) => ({
    nome,
    botao: raiz.querySelector(`#lista-${nome}`),
    form: raiz.querySelector(`#lista-${nome}-form`),
    campo: raiz.querySelector(`#lista-${nome}-campo`),
  }));
  aplicarMascaraMoeda(edicoes.find((e) => e.nome === 'valor').campo);
  const fecharEdicoes = (exceto) => {
    for (const { botao, form } of edicoes) {
      if (form === exceto) continue;
      form.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    }
  };
  for (const { nome, botao, form, campo: entrada } of edicoes) {
    botao.addEventListener('click', () => {
      const abrir = form.hidden;
      fecharMenus();
      fecharEdicoes(abrir ? form : null);
      form.hidden = !abrir;
      botao.setAttribute('aria-expanded', String(abrir));
      if (abrir) entrada.focus();
    }, { signal });
    form.addEventListener('click', (evento) => evento.stopPropagation(), { signal });
    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      // no formulário do valor dá para trocar também o tipo (despesa ou receita): é assim que um valor positivo entra numa despesa
      const mudancas = {};
      if (entrada.value.trim()) mudancas[nome] = entrada.value;
      const tipo = nome === 'valor' ? form.querySelector('input[name="lista-tipo"]:checked')?.value : '';
      if (tipo) mudancas.tipo = tipo;
      if (Object.keys(mudancas).length === 0) {
        entrada.focus();
        return;
      }
      const alvo = marcadasComoLista();
      if (alvo.length === 0) return;
      const aplicado = await alterarVarias(alvo, mudancas); // a página valida; devolve se salvou
      if (aplicado) {
        entrada.value = '';
        form.querySelector('input[name="lista-tipo"][value=""]')?.click();
        fecharEdicoes();
      }
    }, { signal });
  }

  // Trocar a data de todas as marcadas: um botão com o calendário do projeto
  const botaoData = raiz.querySelector('#lista-data');
  const formData = raiz.querySelector('#lista-data-form');
  const calendarioData = ligarCalendario(formData, { signal });
  botaoData.addEventListener('click', () => {
    const abrir = formData.hidden;
    fecharMenus();
    formData.hidden = !abrir;
    botaoData.setAttribute('aria-expanded', String(abrir));
    if (abrir) formData.querySelector('.calendario__caixa').click(); // abre o calendário já com o botão
  }, { signal });
  formData.addEventListener('click', (evento) => evento.stopPropagation(), { signal });
  formData.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const iso = calendarioData.ler();
    const alvo = marcadasComoLista();
    if (!iso || alvo.length === 0) return;
    if (await alterarVarias(alvo, { data: iso })) {
      calendarioData.definir('');
      formData.hidden = true;
      botaoData.setAttribute('aria-expanded', 'false');
    }
  }, { signal });

  // Trocar a categoria ou o pagamento de todas as marcadas: duas listas pequenas na barra escura
  const menus = [
    { botao: raiz.querySelector('#lista-categoria'), menu: raiz.querySelector('#lista-categoria-menu'), campo: 'categoria', opcoes: CATEGORIAS },
    { botao: raiz.querySelector('#lista-pagamento'), menu: raiz.querySelector('#lista-pagamento-menu'), campo: 'formaPagamento', opcoes: FORMAS_PAGAMENTO },
  ];
  const fecharMenus = (exceto) => {
    for (const { botao, menu } of menus) {
      if (menu === exceto) continue;
      menu.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    }
    fecharEdicoes();
    formData.hidden = true;
    botaoData.setAttribute('aria-expanded', 'false');
  };
  for (const { botao, menu, campo: nomeDoCampo, opcoes } of menus) {
    menu.replaceChildren(...opcoes.map((opcao) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'selecao__opcao';
      item.setAttribute('role', 'option');
      item.dataset.valor = opcao.valor;
      if (opcao.cor) item.dataset.cor = opcao.cor;
      item.textContent = opcao.rotulo;
      return item;
    }));
    botao.addEventListener('click', () => {
      const abrir = menu.hidden;
      fecharMenus(abrir ? menu : null);
      menu.hidden = !abrir;
      botao.setAttribute('aria-expanded', String(abrir));
    }, { signal });
    menu.addEventListener('click', (evento) => {
      const item = evento.target.closest('.selecao__opcao');
      if (!item) return;
      fecharMenus();
      alterarVarias(marcadasComoLista(), { [nomeDoCampo]: item.dataset.valor });
    }, { signal });
  }
  document.addEventListener('click', (evento) => {
    // o caminho do evento: clicar num dia do calendário recria os botões antes de o clique chegar aqui
    if (!evento.composedPath().some((el) => el.classList?.contains('selecao__area'))) fecharMenus();
  }, { signal });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') fecharMenus();
  }, { signal });

  // ---------------------------------------------------------------- alterações pendentes
  const barraPendentes = raiz.querySelector('#lista-pendentes');
  const textoPendentes = raiz.querySelector('#lista-pendentes-texto');
  const botaoConfirmar = raiz.querySelector('#lista-confirmar');
  const botaoDescartar = raiz.querySelector('#lista-descartar');

  function atualizarPendentes() {
    let alteracoes = 0;
    for (const campos of rascunho.values()) alteracoes += Object.keys(campos).length;
    barraPendentes.hidden = alteracoes === 0;
    textoPendentes.textContent = `${alteracoes} ${alteracoes === 1 ? 'alteração pendente' : 'alterações pendentes'} em ${rascunho.size} ${rascunho.size === 1 ? 'transação' : 'transações'}`;
  }

  /** Marca alterações (já validadas) em várias transações, sem enviar: quem decide é o usuário, em Confirmar. */
  function rascunhar(transacoes, mudancas) {
    for (const { id } of transacoes) {
      const base = itens.find((t) => t.id === id);
      if (!base) continue;
      const atual = { ...rascunho.get(id) };
      for (const [nome, valor] of Object.entries(mudancas)) {
        if (valor === valorOriginal(base, nome)) delete atual[nome]; // voltou ao que era: não há mais o que enviar
        else atual[nome] = valor;
      }
      if (Object.keys(atual).length > 0) rascunho.set(id, atual);
      else rascunho.delete(id);
    }
    desenhar();
    atualizarPendentes();
  }

  function limparRascunho() {
    rascunho.clear();
    desenhar();
    atualizarPendentes();
  }

  botaoDescartar.addEventListener('click', () => limparRascunho(), { signal });
  botaoConfirmar.addEventListener('click', async () => {
    const lote = [...rascunho].map(([id, alteracoes]) => ({ id, alteracoes }));
    // o contrário do lote (os valores de antes), para o botão "Desfazer" da notificação
    const inverso = lote.map(({ id, alteracoes }) => {
      const base = itens.find((t) => t.id === id);
      return { id, alteracoes: Object.fromEntries(Object.keys(alteracoes).map((nome) => [nome, base ? valorOriginal(base, nome) : undefined])) };
    });
    if (lote.length === 0) return;
    botaoConfirmar.disabled = true;
    botaoDescartar.disabled = true;
    botaoConfirmar.textContent = 'Salvando...';
    try {
      if (await confirmarPendentes(lote, inverso)) {
        marcarTodas(false); // confirmou: a seleção também é limpa
        limparRascunho();
      }
    } finally {
      botaoConfirmar.disabled = false;
      botaoDescartar.disabled = false;
      botaoConfirmar.textContent = 'Confirmar';
    }
  }, { signal });

  const rodape = {
    receitas: raiz.querySelector('#lista-receitas'),
    despesas: raiz.querySelector('#lista-despesas'),
    saldo: raiz.querySelector('#lista-saldo'),
  };

  return {
    /** Mostra o esqueleto cinza (a primeira página); "Carregar mais" não apaga o que já está na tela. */
    iniciarCarga({ acrescentar = false } = {}) {
      if (acrescentar) {
        botaoMais.disabled = true;
        return;
      }
      estado('carregando');
    },

    mostrarResposta(resposta, { acrescentar = false, mensagemVazia = 'Nenhuma transação neste período.' } = {}) {
      itens = acrescentar ? [...itens, ...resposta.itens] : resposta.itens;
      // as marcadas que continuam na lista continuam marcadas (depois de trocar a descrição, dá para trocar o valor); as que sumiram saem
      for (const id of [...marcadas]) if (!itens.some((t) => t.id === id)) marcadas.delete(id);
      atualizarBarraSelecao();

      rodape.receitas.textContent = formatarMoeda(resposta.resumo.receitas);
      rodape.despesas.textContent = formatarMoeda(resposta.resumo.despesas);
      rodape.saldo.textContent = formatarMoeda(resposta.resumo.saldo);
      rodape.saldo.classList.toggle('lista__saldo--negativo', resposta.resumo.saldo < 0);

      botaoMais.hidden = resposta.pagina >= resposta.totalPaginas;
      botaoMais.disabled = false;

      if (itens.length === 0) {
        vazio.textContent = mensagemVazia;
        estado('vazio');
        return;
      }
      desenhar();
      estado('lista');
    },

    mostrarErro(falha) {
      // Falha de rede já vem com mensagem amigável do api.js; os demais erros ganham um texto genérico.
      erroTexto.textContent = falha?.status ? 'Não foi possível carregar as transações.' : (falha?.message ?? 'Erro inesperado.');
      botaoMais.disabled = false;
      estado('erro');
    },

    rascunhar,
    limparRascunho,
    temPendencias: () => rascunho.size > 0,

    /** Tira as alterações pendentes de transações que deixaram de existir (excluídas). */
    descartarRascunhoDe(ids) {
      for (const id of ids) rascunho.delete(id);
      atualizarPendentes();
    },

    /** Põe as metas do usuário (título da coluna Meta e lista de escolha). */
    definirMetas(lista) {
      metas = lista;
      if (itens.length > 0) desenhar();
    },

    definirSelecao(ativo) {
      terminarEdicao();
      selecionando = ativo;
      marcadas.clear();
      fecharMenus();
      secao.classList.toggle('lista--selecionando', ativo);
      for (const linha of grupos.querySelectorAll('.linha')) {
        linha.classList.remove('linha--marcada');
        linha.querySelector('.linha__marca').checked = false;
      }
      atualizarBarraSelecao();
    },
  };
}
