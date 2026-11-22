import { ligarCalendario } from '../../../../shared/components/Calendario.js';
import { isoParaBr } from '../../../../shared/utils/dateRange.js';
import { aplicarMascaraMoeda } from '../../../../shared/components/campos.js';
import { lerValor } from '../../../../shared/utils/moeda.js';
import { CATEGORIAS, FORMAS_PAGAMENTO, TIPOS } from '../../utils/constants.js';

const ORIGENS = [
  { valor: 'manual', rotulo: 'Manual', cor: 'cinza' },
  { valor: 'pluggy', rotulo: 'Open Finance', cor: 'destaque' },
];

const PILULAS = [
  { chave: 'tipo', rotulo: 'Tipo', todas: 'Todos', opcoes: TIPOS },
  { chave: 'categoria', rotulo: 'Categorias', todas: 'Todas', opcoes: CATEGORIAS },
  { chave: 'formaPagamento', rotulo: 'Pagamento', todas: 'Todos', opcoes: FORMAS_PAGAMENTO },
  { chave: 'metaId', rotulo: 'Meta', todas: 'Todas', opcoes: [] }, // as metas chegam depois (definirMetas)
  { chave: 'origem', rotulo: 'Origem', todas: 'Todas', opcoes: ORIGENS },
];

const ESPERA_BUSCA_MS = 300;
const ESPERA_PARA_ABRIR_MS = 120; // evita a lista piscar quando o mouse só passa pela pílula
const ESPERA_PARA_FECHAR_MS = 250; // tolera o vão entre a pílula e a lista
const nomeDoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });

const doisDigitos = (n) => String(n).padStart(2, '0');

const ISO_DO_MES = (ano, mes) => {
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const base = `${ano}-${doisDigitos(mes + 1)}`;
  return { dataInicio: `${base}-01`, dataFim: `${base}-${doisDigitos(ultimoDia)}` };
};

/**
 * Liga a barra do topo (HTML em TransactionBarra.html): mês com setas, "Selecionar", filtros em pílulas e busca. Clicar no
 * mês abre o calendário de período (shared/components/Calendario.js, o mesmo do filtro): escolhidos os dois dias (ou o atalho
 * "Tudo"), a lista passa a mostrar esse período; as setas voltam a andar de mês em mês.
 * Chama `aoMudar(parametros)` com os parâmetros da API (período do mês mais os filtros) na primeira vez e a cada mudança, e
 * `aoSelecionar(ativo)` ao ligar ou desligar o modo de seleção. `aoNovo(tipo)` é chamado pelo menu do botão Lançamento
 * (Nova despesa, Nova receita) e pelas letras D e R. Devolve { definirMetas(metas), sairDaSelecao() }.
 */
export function iniciarBarra(raiz, { aoMudar, aoSelecionar, aoNovo, signal }) {
  const hoje = new Date();
  // `periodo`: null (o mês das setas), { dataInicio, dataFim } (período escolhido no calendário) ou { tudo: true } (sem datas)
  const estado = { ano: hoje.getFullYear(), mes: hoje.getMonth(), periodo: null, filtros: {}, faixa: { min: null, max: null }, busca: '', selecionando: false };

  const titulo = raiz.querySelector('#barra-mes');
  const caixaPilulas = raiz.querySelector('#barra-pilulas');
  const botaoSelecionar = raiz.querySelector('#barra-selecionar');
  const textoSelecionar = raiz.querySelector('#barra-selecionar-texto');
  // A busca fica no cabeçalho da coluna Descrição (a célula com data-busca na lista); o campo é montado aqui.
  const celulaBusca = raiz.querySelector('[data-busca]');
  const rotuloBusca = document.createElement('label');
  rotuloBusca.className = 'barra__busca';
  rotuloBusca.htmlFor = 'barra-busca-campo';
  const campoBusca = document.createElement('input');
  campoBusca.type = 'search';
  campoBusca.id = 'barra-busca-campo';
  campoBusca.className = 'barra__busca-campo';
  campoBusca.placeholder = 'Buscar por descrição';
  campoBusca.autocomplete = 'off';
  rotuloBusca.append(campoBusca);
  rotuloBusca.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>');
  celulaBusca?.replaceChildren(rotuloBusca);
  let temporizadorBusca;

  function parametros() {
    let resultado = {};
    if (!estado.periodo) resultado = ISO_DO_MES(estado.ano, estado.mes);
    else if (!estado.periodo.tudo) resultado = { dataInicio: estado.periodo.dataInicio, dataFim: estado.periodo.dataFim };
    for (const [chave, valor] of Object.entries(estado.filtros)) if (valor) resultado[chave] = valor;
    if (estado.faixa.min !== null) resultado.valorMin = estado.faixa.min;
    if (estado.faixa.max !== null) resultado.valorMax = estado.faixa.max;
    if (estado.busca) resultado.busca = estado.busca;
    return resultado;
  }

  function aplicar() {
    if (!estado.periodo) {
      const nome = nomeDoMes.format(new Date(Date.UTC(estado.ano, estado.mes, 1)));
      titulo.textContent = `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${estado.ano}`;
    } else if (estado.periodo.tudo) {
      titulo.textContent = 'Todo o período';
    } else {
      titulo.textContent = `${isoParaBr(estado.periodo.dataInicio)} a ${isoParaBr(estado.periodo.dataFim)}`;
    }
    atualizarLimpar();
    aoMudar(parametros());
  }

  function mudarMes(passo) {
    if (estado.periodo?.dataInicio) {
      // vindo de um período: as setas andam a partir do mês em que ele começa
      const [ano, mes] = estado.periodo.dataInicio.split('-').map(Number);
      estado.ano = ano;
      estado.mes = mes - 1;
    }
    estado.periodo = null;
    ignorarCalendario(() => periodoCalendario.definir()); // limpa as duas caixas sem aplicar nada
    const data = new Date(estado.ano, estado.mes + passo, 1);
    estado.ano = data.getFullYear();
    estado.mes = data.getMonth();
    aplicar();
  }

  // ---------------------------------------------------------------- calendário de período (clicar no mês)
  const botaoMes = raiz.querySelector('#barra-mes-botao');
  const areaMes = raiz.querySelector('.barra__mes-area');
  const caixaPeriodo = raiz.querySelector('#barra-periodo');
  const periodoCalendario = ligarCalendario(caixaPeriodo.querySelector('.periodo'), { signal });
  let ignorando = false; // as caixas disparam "change" também quando é o código que as escreve

  function ignorarCalendario(acao) {
    ignorando = true;
    try { acao(); } finally { ignorando = false; }
  }

  function fecharPeriodo() {
    caixaPeriodo.hidden = true;
    botaoMes.setAttribute('aria-expanded', 'false');
  }

  botaoMes.addEventListener('click', () => {
    const abrir = caixaPeriodo.hidden;
    if (!abrir) {
      fecharPeriodo();
      return;
    }
    caixaPeriodo.hidden = false;
    botaoMes.setAttribute('aria-expanded', 'true');
    // abre o calendário (ele abre ao clicar na caixa de início); depois que este clique termina de subir, senão o clique
    // fora do calendário (neste botão) o fecharia na hora
    setTimeout(() => caixaPeriodo.querySelector('.calendario__caixa').click(), 0);
  }, { signal });

  caixaPeriodo.addEventListener('change', () => {
    if (ignorando) return;
    const { dataInicio, dataFim, erro } = periodoCalendario.ler();
    if (erro) return; // data inválida ou final antes do início: o calendário mostra o erro
    if (dataInicio && dataFim) estado.periodo = { dataInicio, dataFim };
    else if (!dataInicio && !dataFim) estado.periodo = { tudo: true }; // "Tudo" ou "Limpar"
    else return; // só uma das datas: espera a outra
    fecharPeriodo();
    aplicar();
  }, { signal });

  // "Tudo" e "Limpar" com as caixas já vazias não mudam nenhum valor (não há "change"): o clique aplica do mesmo jeito
  caixaPeriodo.addEventListener('click', (evento) => {
    if (!evento.target.closest('[data-atalho="tudo"], .calendario__limpar') || estado.periodo?.tudo) return;
    estado.periodo = { tudo: true };
    fecharPeriodo();
    aplicar();
  }, { signal });

  document.addEventListener('click', (evento) => {
    // o caminho do evento: clicar num dia recria os botões do calendário antes de o clique chegar aqui
    if (!caixaPeriodo.hidden && !evento.composedPath().includes(areaMes)) fecharPeriodo();
  }, { signal });

  raiz.querySelector('#barra-mes-anterior').addEventListener('click', () => mudarMes(-1), { signal });
  raiz.querySelector('#barra-mes-seguinte').addEventListener('click', () => mudarMes(1), { signal });

  // ---------------------------------------------------------------- menu do botão Lançamento
  const areaNovo = raiz.querySelector('#barra-novo-area');
  const menuNovo = raiz.querySelector('#barra-novo-menu');
  let temporizadorMenu;

  function abrirMenuNovo() {
    clearTimeout(temporizadorMenu);
    menuNovo.classList.add('barra__novo-menu--aberto');
    menuNovo.setAttribute('aria-hidden', 'false');
  }
  function fecharMenuNovo(espera = 0) {
    clearTimeout(temporizadorMenu);
    temporizadorMenu = setTimeout(() => {
      menuNovo.classList.remove('barra__novo-menu--aberto');
      menuNovo.setAttribute('aria-hidden', 'true');
    }, espera);
  }
  areaNovo.addEventListener('mouseenter', abrirMenuNovo, { signal });
  areaNovo.addEventListener('mouseleave', () => fecharMenuNovo(200), { signal }); // tolera o vão entre o botão e o menu
  areaNovo.addEventListener('focusin', abrirMenuNovo, { signal });
  areaNovo.addEventListener('focusout', (evento) => {
    if (!areaNovo.contains(evento.relatedTarget)) fecharMenuNovo();
  }, { signal });
  menuNovo.addEventListener('click', (evento) => {
    const item = evento.target.closest('[data-tipo]');
    if (!item) return;
    fecharMenuNovo();
    aoNovo(item.dataset.tipo);
  }, { signal });
  signal?.addEventListener('abort', () => clearTimeout(temporizadorMenu));

  // as letras D e R abrem o formulário (só fora de campos de texto e sem painel aberto)
  document.addEventListener('keydown', (evento) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey || evento.repeat) return;
    const tipo = { d: 'despesa', r: 'receita' }[evento.key.toLowerCase()];
    if (!tipo) return;
    const alvo = evento.target;
    if (alvo instanceof HTMLElement && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
    if (document.querySelector('.transactions-painel--aberto, .detalhe--aberto')) return;
    evento.preventDefault();
    aoNovo(tipo);
  }, { signal });

  // ---------------------------------------------------------------- filtros recolhíveis (só em tela estreita, ver o CSS)
  const botaoFiltros = raiz.querySelector('#barra-filtros-toggle');
  const textoFiltros = raiz.querySelector('#barra-filtros-toggle-texto');
  const painelFiltros = raiz.querySelector('#barra-filtros-painel');
  botaoFiltros.addEventListener('click', () => {
    const recolher = botaoFiltros.getAttribute('aria-expanded') === 'true';
    botaoFiltros.setAttribute('aria-expanded', String(!recolher));
    textoFiltros.textContent = recolher ? 'Mostrar filtros' : 'Ocultar filtros';
    painelFiltros.toggleAttribute('data-recolhido', recolher);
  }, { signal });

  // ---------------------------------------------------------------- seleção
  function definirSelecao(ativo) {
    estado.selecionando = ativo;
    botaoSelecionar.setAttribute('aria-pressed', String(ativo));
    textoSelecionar.textContent = ativo ? 'Cancelar' : 'Selecionar';
    aoSelecionar(ativo);
  }
  botaoSelecionar.addEventListener('click', () => definirSelecao(!estado.selecionando), { signal });

  // ---------------------------------------------------------------- filtros
  // Cada filtro existe em dois lugares: no CABEÇALHO DAS COLUNAS da lista (telas largas) e no PAINEL recolhível da barra (telas
  // estreitas, em que as colunas somem). O CSS mostra um ou o outro; os dois leem e escrevem o mesmo estado (`estado`).
  const instancias = new Map(); // chave do filtro ('tipo', 'categoria', ..., 'valor') -> [{ botao, menu, rotuloTexto, base, noCabecalho, campos }]
  const todasInstancias = () => [...instancias.values()].flat();
  const botaoLimpar = raiz.querySelector('#barra-limpar-filtros');
  const SETA = '<svg class="barra__cab-seta" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const reais = (n) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  let contador = 0;

  function fecharMenus(exceto) {
    for (const { botao, menu } of todasInstancias()) {
      if (menu === exceto) continue;
      menu.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    }
  }

  function desenharOpcoes(config, menu) {
    const itens = [{ valor: '', rotulo: config.todas }, ...config.opcoes].map((opcao) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'barra__opcao';
      item.setAttribute('role', 'option');
      item.dataset.valor = opcao.valor;
      if (opcao.cor) item.dataset.cor = opcao.cor;
      item.textContent = opcao.rotulo;
      item.setAttribute('aria-selected', String((estado.filtros[config.chave] ?? '') === opcao.valor));
      return item;
    });
    menu.replaceChildren(...itens);
  }

  function filtroDeValorAtivo() {
    return estado.faixa.min !== null || estado.faixa.max !== null;
  }

  function textoDoValor() {
    const { min, max } = estado.faixa;
    if (min !== null && max !== null) return `R$ ${reais(min)} a ${reais(max)}`;
    if (min !== null) return `A partir de R$ ${reais(min)}`;
    if (max !== null) return `Até R$ ${reais(max)}`;
    return null;
  }

  /** Atualiza o rótulo e a cor de todos os botões de um filtro (cabeçalho e painel) a partir do estado. */
  function atualizarFiltro(chave) {
    const config = PILULAS.find((p) => p.chave === chave);
    const ativo = chave === 'valor' ? filtroDeValorAtivo() : Boolean(estado.filtros[chave]);
    const texto = chave === 'valor' ? textoDoValor() : config?.opcoes.find((o) => o.valor === estado.filtros[chave])?.rotulo;
    for (const inst of instancias.get(chave) ?? []) {
      // no cabeçalho o título da coluna não muda (só ganha a cor de destaque); no painel o botão mostra a opção escolhida
      inst.rotuloTexto.textContent = ativo && texto && !inst.noCabecalho ? texto : inst.base;
      inst.botao.classList.toggle('barra__pilula--ativa', ativo);
      if (chave === 'valor') {
        for (const outra of instancias.get('valor')) {
          outra.campos.min.value = estado.faixa.min === null ? '' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(estado.faixa.min);
          outra.campos.max.value = estado.faixa.max === null ? '' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(estado.faixa.max);
        }
      }
    }
  }

  /** Monta um filtro (botão e menu) dentro de `destino`. `noCabecalho`: o botão leva o estilo do título da coluna. */
  function criarFiltro(config, destino, noCabecalho) {
    const ehValor = config.chave === 'valor';
    const base = noCabecalho ? destino.textContent.trim() : config.rotulo;

    const area = document.createElement('div');
    area.className = 'barra__pilula-area' + (noCabecalho ? ' barra__pilula-area--cab' : '');
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = noCabecalho ? 'barra__cab-filtro' : 'barra__pilula';
    botao.setAttribute('aria-haspopup', ehValor ? 'dialog' : 'listbox');
    botao.setAttribute('aria-expanded', 'false');
    const rotuloTexto = document.createElement('span');
    rotuloTexto.textContent = base;
    botao.append(rotuloTexto);
    botao.insertAdjacentHTML('beforeend', SETA);

    let menu;
    let campos = null;
    if (ehValor) {
      const n = ++contador;
      menu = document.createElement('form');
      menu.className = 'barra__menu barra__menu--valor';
      menu.setAttribute('aria-label', 'Filtrar por valor');
      menu.noValidate = true;
      menu.innerHTML = `
        <div class="barra__valor-campos">
          <div class="campo">
            <label for="barra-valor-min-${n}">Mínimo (R$)</label>
            <input type="text" id="barra-valor-min-${n}" name="min" inputmode="decimal" placeholder="0,00" autocomplete="off">
          </div>
          <div class="campo">
            <label for="barra-valor-max-${n}">Máximo (R$)</label>
            <input type="text" id="barra-valor-max-${n}" name="max" inputmode="decimal" placeholder="Sem limite" autocomplete="off">
          </div>
        </div>
        <p class="barra__valor-erro" role="alert" hidden></p>
        <div class="barra__valor-acoes">
          <button type="button" class="barra__valor-limpar transactions-botao transactions-botao--secundario">Limpar</button>
          <button type="submit" class="barra__valor-aplicar transactions-botao">Aplicar</button>
        </div>`;
      campos = { min: menu.elements.min, max: menu.elements.max };
      aplicarMascaraMoeda(campos.min);
      aplicarMascaraMoeda(campos.max);
      const erro = menu.querySelector('.barra__valor-erro');

      menu.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const min = campos.min.value.trim() === '' ? null : lerValor(campos.min.value);
        const max = campos.max.value.trim() === '' ? null : lerValor(campos.max.value);
        let mensagem = '';
        if (Number.isNaN(min) || Number.isNaN(max)) mensagem = 'Digite só números, como 150 ou 49,90.';
        else if (min !== null && max !== null && min > max) mensagem = 'O mínimo não pode ser maior que o máximo.';
        erro.textContent = mensagem;
        erro.hidden = !mensagem;
        if (mensagem) return;
        estado.faixa = { min, max };
        atualizarFiltro('valor');
        fecharMenus();
        aplicar();
      }, { signal });
      menu.querySelector('.barra__valor-limpar').addEventListener('click', () => {
        erro.hidden = true;
        estado.faixa = { min: null, max: null };
        atualizarFiltro('valor');
        fecharMenus();
        aplicar();
      }, { signal });
    } else {
      menu = document.createElement('div');
      menu.className = 'barra__menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', config.rotulo);
      menu.addEventListener('click', (evento) => {
        const item = evento.target.closest('.barra__opcao');
        if (!item) return;
        estado.filtros[config.chave] = item.dataset.valor;
        atualizarFiltro(config.chave);
        fecharMenus();
        aplicar();
      }, { signal });
    }
    menu.hidden = true;

    const abrirMenu = () => {
      fecharMenus(menu);
      if (!ehValor) desenharOpcoes(config, menu);
      menu.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
    };
    const fecharEste = () => {
      menu.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
    };
    botao.addEventListener('click', () => (menu.hidden ? abrirMenu() : fecharEste()), { signal });

    // como as listas dos selects do projeto: abre ao passar o mouse (com uma pequena espera) e fecha ao sair; o clique também
    // alterna. A lista do valor não fecha enquanto o foco está nos campos (a pessoa está digitando).
    let espera;
    area.addEventListener('mouseenter', () => {
      clearTimeout(espera);
      espera = setTimeout(() => { if (menu.hidden) abrirMenu(); }, ESPERA_PARA_ABRIR_MS);
    }, { signal });
    area.addEventListener('mouseleave', () => {
      clearTimeout(espera);
      espera = setTimeout(() => { if (!menu.contains(document.activeElement)) fecharEste(); }, ESPERA_PARA_FECHAR_MS);
    }, { signal });
    signal?.addEventListener('abort', () => clearTimeout(espera));

    area.append(botao, menu);
    if (noCabecalho) destino.replaceChildren(area);
    else destino.append(area);
    if (!instancias.has(config.chave)) instancias.set(config.chave, []);
    instancias.get(config.chave).push({ botao, menu, rotuloTexto, base, noCabecalho, campos });
  }

  // a lista de filtros, na ordem das colunas: Tipo, Categoria, Pagamento, Meta, Origem e Valor
  const FILTROS = [...PILULAS, { chave: 'valor', rotulo: 'Valor' }];
  for (const config of FILTROS) {
    criarFiltro(config, caixaPilulas, false);
    const celula = raiz.querySelector(`[data-filtro="${config.chave}"]`);
    if (celula) criarFiltro(config, celula, true);
  }

  // "Limpar filtros" (na primeira linha, só aparece com algum filtro ligado)
  function atualizarLimpar() {
    const ativos = Object.values(estado.filtros).some(Boolean) || filtroDeValorAtivo();
    botaoLimpar.hidden = !ativos;
  }

  botaoLimpar.addEventListener('click', () => {
    estado.filtros = {};
    estado.faixa = { min: null, max: null };
    for (const chave of instancias.keys()) atualizarFiltro(chave);
    fecharMenus();
    aplicar();
  }, { signal });

  // clicar fora ou Esc fecham a lista aberta
  document.addEventListener('click', (evento) => {
    // o caminho do evento: escolher uma opção redesenha a lista antes de o clique chegar aqui
    if (!evento.composedPath().some((el) => el.classList?.contains('barra__pilula-area'))) fecharMenus();
  }, { signal });
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    fecharMenus();
    fecharMenuNovo();
    fecharPeriodo();
  }, { signal });

  // ---------------------------------------------------------------- busca (sempre à vista, aplica ao parar de digitar)
  campoBusca.addEventListener('input', () => {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(() => {
      estado.busca = campoBusca.value.trim();
      aplicar();
    }, ESPERA_BUSCA_MS);
  }, { signal });
  campoBusca.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape' || !campoBusca.value) return;
    campoBusca.value = '';
    estado.busca = '';
    aplicar();
  }, { signal });
  signal?.addEventListener('abort', () => clearTimeout(temporizadorBusca));

  aplicar(); // primeira consulta: o mês atual, sem filtros

  return {
    /** Põe as metas do usuário na pílula "Meta". */
    definirMetas(metas) {
      const config = PILULAS.find((p) => p.chave === 'metaId');
      config.opcoes = metas.map((meta) => ({ valor: meta.id, rotulo: meta.titulo }));
      atualizarFiltro(config.chave);
    },

    sairDaSelecao() {
      if (estado.selecionando) definirSelecao(false);
    },
  };
}
