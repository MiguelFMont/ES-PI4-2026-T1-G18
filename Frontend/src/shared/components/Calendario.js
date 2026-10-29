import { isoDeData, isoParaBr, lerData, lerPeriodo, mascararData, periodoPredefinido } from '../utils/dateRange.js';
import { entradaPorTeclado } from '../utils/entrada.js';

const MESES_EM_TEXTO = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const DATA_EM_TEXTO = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

const ESPERA_PARA_ABRIR_MS = 120; // evita o calendário piscar quando o mouse só passa pelo campo
const ESPERA_PARA_FECHAR_MS = 250; // tolera o vão entre as caixas e o calendário

const iso = (ano, mes, dia) => isoDeData(new Date(ano, mes, dia));

/**
 * Liga um campo de data com calendário. `area` é o elemento que tem `data-calendario` e contém:
 *   - uma caixa (data única) ou duas (período: "Início" e "Final") com a classe `calendario__caixa`;
 *   - o calendário, incluído de shared/components/calendario/Calendario.html.
 *
 * - O calendário abre ao passar o mouse sobre o campo, ou quando o foco chega por Tab. Clicar no campo não o mantém
 *   aberto: ao tirar o mouse ele fecha (a menos que o foco tenha chegado por teclado e continue dentro do campo).
 * - Data única: clicar em um dia escolhe a data e fecha. Período: o 1º clique escolhe o início, o 2º o final e fecha;
 *   os atalhos ("Hoje", "Últimos 30 dias"...) preenchem as duas caixas de uma vez.
 * - Também dá para digitar dd/mm/aaaa (a máscara põe as barras). Quando o valor muda, a caixa dispara `change`.
 *
 * Período devolve `{ ler(), definir(), definirIso(inicio, fim), definirErro(mensagem) }`.
 * Data única devolve `{ controle, focar(), ler(), definir(iso), definirErro(mensagem) }`, o formato de ligarCampo().
 */
export function ligarCalendario(area, { signal } = {}) {
  const caixas = [...area.querySelectorAll('.calendario__caixa')];
  const [caixaInicio, caixaFim = null] = caixas;
  const periodo = caixas.length === 2;
  const mensagemErro = area.querySelector('.campo__erro');
  const calendario = area.querySelector('.calendario');
  const semanas = area.querySelector('.calendario__semanas');
  const modeloSemana = area.querySelector('.calendario__modelo-semana');
  const rotuloMes = area.querySelector('.calendario__mes');
  const hoje = new Date();
  const hojeIso = iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  let mes = { ano: hoje.getFullYear(), indice: hoje.getMonth() };
  let valorAoAbrir = '';
  let devolvendoFoco = false; // ao devolver o foco a uma caixa, o evento `focus` não deve reabrir o calendário
  let temporizador;

  if (periodo) area.querySelector('.calendario__atalhos').hidden = false;

  // Os atalhos ficam ao lado do calendário (à esquerda do campo) se couberem dentro da área da tela; senão, acima do mês.
  function posicionarAtalhos() {
    if (!periodo) return;
    const raizTela = area.closest('#app-content') ?? document.body;
    const largura = 9.5 * parseFloat(getComputedStyle(document.documentElement).fontSize) + 4; // painel + vão
    const folga = area.getBoundingClientRect().left - raizTela.getBoundingClientRect().left;
    calendario.classList.toggle('calendario--atalhos-esquerda', folga >= largura + 16);
  }

  const aberto = () => calendario.classList.contains('calendario--aberto');
  const valorAtual = () => caixas.map((caixa) => caixa.value).join('|');
  // As datas das caixas como estão (a que for válida). A regra "final não pode ser anterior à inicial" é conferida
  // por lerPeriodo, em `ler()`, e vira o erro mostrado no campo.
  const selecao = () => ({
    dataInicio: lerData(caixaInicio.value).iso,
    dataFim: caixaFim ? lerData(caixaFim.value).iso : '',
  });

  // O painel de atalhos tem a altura do calendário, que muda com o mês (5 ou 6 semanas). Se o calendário ficar mais baixo
  // do que os atalhos precisam, ele cresce até caber todos, para nenhum botão ser cortado.
  function ajustarAlturaAtalhos() {
    calendario.style.minHeight = '';
    if (!calendario.classList.contains('calendario--atalhos-esquerda')) return;
    const atalhos = area.querySelector('.calendario__atalhos');
    // o scrollHeight não conta o espaço de baixo do painel quando o conteúdo ultrapassa a altura: soma-se aqui
    const necessaria = atalhos.scrollHeight + parseFloat(getComputedStyle(atalhos).paddingBottom);
    if (necessaria > calendario.offsetHeight) calendario.style.minHeight = `${necessaria}px`;
  }

  function desenhar() {
    const { dataInicio, dataFim } = selecao();
    rotuloMes.textContent = MESES_EM_TEXTO.format(new Date(mes.ano, mes.indice, 1));

    const primeiroDiaDaSemana = new Date(mes.ano, mes.indice, 1).getDay();
    const diasNoMes = new Date(mes.ano, mes.indice + 1, 0).getDate();
    const linhas = [];

    for (let dia = 1 - primeiroDiaDaSemana; dia <= diasNoMes; dia += 7) {
      const linha = modeloSemana.content.firstElementChild.cloneNode(true);
      linha.querySelectorAll('button').forEach((botao, coluna) => {
        const numero = dia + coluna;
        if (numero < 1 || numero > diasNoMes) {
          botao.hidden = true; // fora do mês
          return;
        }
        const data = iso(mes.ano, mes.indice, numero);
        botao.textContent = String(numero);
        botao.dataset.data = data;
        botao.setAttribute('aria-label', DATA_EM_TEXTO.format(new Date(mes.ano, mes.indice, numero)));
        if (data === hojeIso) botao.classList.add('calendario__dia--hoje');
        if (data === dataInicio) botao.classList.add('calendario__dia--inicio');
        if (data === dataFim) botao.classList.add('calendario__dia--fim');
        if (data === dataInicio || data === dataFim) botao.setAttribute('aria-pressed', 'true');
      });
      linhas.push(linha);
    }
    semanas.replaceChildren(...linhas);
    ajustarAlturaAtalhos();
  }

  function abrir() {
    clearTimeout(temporizador);
    if (aberto()) return;
    const { dataInicio, dataFim } = selecao();
    const referencia = dataInicio || dataFim;
    if (referencia) mes = { ano: Number(referencia.slice(0, 4)), indice: Number(referencia.slice(5, 7)) - 1 };
    valorAoAbrir = valorAtual();
    posicionarAtalhos();
    desenhar();
    calendario.classList.add('calendario--aberto');
    caixas.forEach((caixa) => caixa.setAttribute('aria-expanded', 'true'));
  }

  function fechar() {
    clearTimeout(temporizador);
    if (!aberto()) return;
    calendario.classList.remove('calendario--aberto');
    caixas.forEach((caixa) => caixa.setAttribute('aria-expanded', 'false'));
    if (valorAtual() !== valorAoAbrir) caixaInicio.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function devolverFoco(caixa) {
    devolvendoFoco = true;
    caixa.focus();
    devolvendoFoco = false;
  }

  function escreverSelecao(dataInicio, dataFim) {
    caixaInicio.value = isoParaBr(dataInicio);
    if (caixaFim) caixaFim.value = isoParaBr(dataFim);
  }

  function escolherDia(data) {
    if (!periodo) {
      escreverSelecao(data, '');
      fechar();
      devolverFoco(caixaInicio);
      return;
    }

    const { dataInicio, dataFim } = selecao();
    if (dataInicio && dataFim) {
      escreverSelecao(data, ''); // já havia um período completo: começa outro
    } else if (dataInicio) {
      escreverSelecao(dataInicio, data); // se a final for anterior à inicial, o campo mostra o erro
    } else if (dataFim) {
      escreverSelecao(data, dataFim);
    } else {
      escreverSelecao(data, '');
    }

    if (selecao().dataInicio && selecao().dataFim) {
      fechar();
      devolverFoco(caixaFim);
      return;
    }
    desenhar();
    semanas.querySelector(`[data-data="${data}"]`)?.focus(); // o botão clicado foi recriado: devolve o foco
  }

  function mudarMes(passo) {
    const novo = new Date(mes.ano, mes.indice + passo, 1);
    mes = { ano: novo.getFullYear(), indice: novo.getMonth() };
    desenhar();
  }

  // Abertura: mouse sobre o campo (com uma pequena espera) ou foco por Tab. Clicar não mantém o calendário aberto.
  area.addEventListener('mouseenter', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(abrir, ESPERA_PARA_ABRIR_MS);
  });
  area.addEventListener('mouseleave', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const focoPorTeclado = area.contains(document.activeElement) && entradaPorTeclado();
      if (!focoPorTeclado) fechar();
    }, ESPERA_PARA_FECHAR_MS);
  });

  for (const caixa of caixas) {
    caixa.addEventListener('focus', () => {
      if (!devolvendoFoco && entradaPorTeclado()) abrir();
    });
    caixa.addEventListener('input', () => {
      caixa.value = mascararData(caixa.value);
      if (aberto()) desenhar(); // quem digita vê o calendário acompanhar
    });
    caixa.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' || evento.key === 'Enter') fechar();
    });
  }

  area.querySelectorAll('.calendario__nav').forEach((botao) => {
    botao.addEventListener('click', () => mudarMes(Number(botao.dataset.nav)));
  });
  area.querySelector('.calendario__limpar').addEventListener('click', () => {
    escreverSelecao('', '');
    fechar();
    devolverFoco(caixaInicio);
  });
  area.querySelectorAll('.calendario__atalho').forEach((botao) => {
    botao.addEventListener('click', () => {
      const predefinido = periodoPredefinido(botao.dataset.atalho);
      if (!predefinido) return;
      escreverSelecao(predefinido.inicio, predefinido.fim); // "Tudo" limpa as duas datas
      fechar();
      devolverFoco(caixaFim);
    });
  });
  semanas.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-data]');
    if (botao) escolherDia(botao.dataset.data);
  });

  // Clicar fora fecha. O caminho do evento (composedPath) é usado porque o botão clicado pode já ter sido
  // recriado pelo calendário quando este ouvinte roda, e aí `target` já não está dentro da área.
  document.addEventListener('click', (evento) => {
    if (aberto() && !evento.composedPath().includes(area)) fechar();
  }, { signal }); // `signal` tira este ouvinte do document quando a tela é desmontada
  calendario.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      fechar();
      devolverFoco(caixaInicio);
    }
  });
  // Tab para fora do campo também fecha. A checagem espera um instante: ao recriar os dias o foco passa
  // por "nenhum elemento" antes de voltar ao botão certo.
  area.addEventListener('focusout', () => {
    setTimeout(() => {
      if (aberto() && !area.contains(document.activeElement)) fechar();
    }, 0);
  });

  function definirErro(mensagem) {
    mensagemErro.hidden = !mensagem;
    mensagemErro.textContent = mensagem ?? '';
    for (const caixa of caixas) {
      if (mensagem) caixa.setAttribute('aria-invalid', 'true');
      else caixa.removeAttribute('aria-invalid');
    }
  }

  if (periodo) {
    return {
      ler: () => lerPeriodo(caixaInicio.value, caixaFim.value), // com `erro` quando há data inválida ou final antes da inicial
      definir() {
        escreverSelecao('', '');
      },
      definirIso: escreverSelecao,
      definirErro,
    };
  }

  return {
    controle: caixaInicio,
    focar: () => caixaInicio.focus(),
    ler: () => lerData(caixaInicio.value).iso, // vazio se a data estiver em branco ou inválida
    definir: (valor) => escreverSelecao(valor, ''),
    definirErro,
  };
}
