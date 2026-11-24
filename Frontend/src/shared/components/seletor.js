import { entradaPorTeclado } from '../utils/entrada.js';
import { iconeDaOpcao, svgDoIcone } from '../utils/icones.js';
import { mostrarLogoDoBanco } from '../utils/avatar.js';

const ESPERA_PARA_ABRIR_MS = 120; // evita a lista piscar quando o mouse só passa pelo campo
const ESPERA_PARA_FECHAR_MS = 250; // tolera o vão entre o campo e a lista
const DURACAO_FADE_MS = 220; // um pouco mais que a transição de 0,2 s da lista no CSS
const MARGEM_PX = 12; // folga entre a lista e a borda da janela
const ALTURA_MINIMA_PX = 120; // a lista nunca fica menor que isso

/**
 * Liga as listas dos selects dos campos com a classe `campo--seletor` dentro de `raiz` (o HTML de cada campo está em
 * quem o usa, ex.: TransactionFilters.html). Precisa do <template id="modelo-opcao-seletor"> dentro de `raiz`.
 * O <select> continua sendo quem guarda o valor e dispara `change`; a lista abaixo dele é só a forma de escolher:
 *
 * - abre ao passar o mouse sobre o campo e quando o campo é selecionado por Tab (clicar no campo não o mantém aberto);
 * - fecha ao tirar o mouse (se o foco não tiver chegado por Tab), ao sair do campo com Tab, com Esc ou ao clicar fora;
 * - clicar numa opção a escolhe; com o campo selecionado por Tab, as setas (e Home/End) trocam a opção e a lista
 *   acompanha. Enter ou Espaço abrem ou fecham a lista, e Esc fecha.
 *
 * Dentro de uma janela (um elemento com o atributo data-folha) a lista não abre embaixo do campo: ela surge no MEIO da tela, com a largura da
 * janela e o fundo escurecido (sem desfoque), um título (o rótulo do campo), o botão de fechar e linhas maiores, com o círculo ou quadrado do banco (ver shared/utils/avatar.js)
 * ou o ícone da opção (select com data-icones="categoria", "pagamento" ou "tipo"; ver shared/utils/icones.js) e o "visto" na escolhida.
 * `seletor:rodape` no campo (quem usa o campo decide o que fazer, por exemplo criar um cartão).
 *
 * O clique direto no <select> não abre a lista nativa do navegador (pointer-events: none no CSS) e as teclas Enter,
 * Espaço e as setas são tratadas aqui, para não aparecerem duas listas.
 */
export function ligarSeletores(raiz, signal) {
  const modelo = raiz.querySelector('#modelo-opcao-seletor');
  const cadaCampo = raiz.querySelectorAll('.campo--seletor');

  for (const campo of cadaCampo) ligarSeletor(campo, modelo, signal);

  // clicar fora de qualquer campo fecha as listas (o caminho do evento evita erro se a opção clicada foi recriada)
  document.addEventListener('click', (evento) => {
    for (const campo of cadaCampo) {
      if (!evento.composedPath().includes(campo)) campo.dispatchEvent(new CustomEvent('seletor:fechar'));
    }
  }, { signal }); // `signal` tira este ouvinte do document quando a tela é desmontada
}

function ligarSeletor(campo, modelo, signal) {
  const select = campo.querySelector('select');
  const lista = campo.querySelector('.seletor__lista');
  const janela = campo.closest('[data-folha]'); // a janela de que a lista sobe, se o campo estiver numa
  const emFolha = Boolean(janela);
  let temporizador;
  let limpeza;

  const aberta = () => lista.classList.contains('seletor__lista--aberta');
  const focoPorTeclado = () => document.activeElement === select && entradaPorTeclado();

  /** O título da folha: o rótulo do campo, sem o asterisco de obrigatório. */
  const tituloDaFolha = () => (campo.querySelector('label')?.textContent ?? '').replace('*', '').trim();

  function itemDaFolha(opcao) {
    const item = modelo.content.firstElementChild.cloneNode(true);
    item.classList.add('seletor__opcao--folha');
    item.dataset.valor = opcao.value;
    item.setAttribute('aria-selected', String(opcao.selected));
    if (opcao.selected) item.classList.add('seletor__opcao--escolhida');
    const icone = select.dataset.icones ? iconeDaOpcao(select.dataset.icones, opcao.value) : null;
    if (icone) {
      const marca = document.createElement('span');
      marca.className = 'seletor__icone';
      marca.style.setProperty('--icone-cor', `var(--matiz-${icone.cor})`);
      marca.innerHTML = icone.svg; // texto fixo do projeto (shared/utils/icones.js), não vem da API
      item.append(marca);
    }
    if (opcao.dataset.avatarSigla) {
      const avatar = document.createElement('span');
      avatar.className = 'seletor__avatar' + (opcao.dataset.avatarForma === 'quadrado' ? ' seletor__avatar--quadrado' : '');
      const desenho = opcao.dataset.avatarIcone ? svgDoIcone(opcao.dataset.avatarIcone) : null;
      if (desenho) avatar.innerHTML = desenho; // texto fixo do projeto (shared/utils/icones.js)
      else if (!(opcao.dataset.avatarLogo && mostrarLogoDoBanco(avatar, opcao.dataset.avatarLogo, opcao.dataset.avatarSigla))) avatar.textContent = opcao.dataset.avatarSigla;
      avatar.style.setProperty('--avatar-fundo', opcao.dataset.avatarFundo);
      avatar.style.setProperty('--avatar-texto', opcao.dataset.avatarTexto);
      avatar.setAttribute('aria-hidden', 'true');
      item.append(avatar);
    }
    const textos = document.createElement('span');
    textos.className = 'seletor__textos';
    const titulo = document.createElement('span');
    titulo.className = 'seletor__titulo';
    titulo.textContent = opcao.dataset.titulo ?? opcao.textContent;
    textos.append(titulo);
    if (opcao.dataset.subtitulo) {
      const subtitulo = document.createElement('span');
      subtitulo.className = 'seletor__subtitulo';
      subtitulo.textContent = opcao.dataset.subtitulo;
      textos.append(subtitulo);
    }
    item.append(textos);
    if (opcao.selected && opcao.value !== '') item.insertAdjacentHTML('beforeend', '<svg class="seletor__visto" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    return item;
  }

  function desenharFolha() {
    const cabecalho = document.createElement('div');
    cabecalho.className = 'seletor__cabecalho';
    const titulo = document.createElement('span');
    titulo.textContent = tituloDaFolha();
    const fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'seletor__fechar';
    fechar.setAttribute('aria-label', 'Fechar a lista');
    fechar.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    cabecalho.append(titulo, fechar);

    // o texto-guia ("Selecione...", "Escolha o cartão") não é uma escolha: não entra na lista em folha
    const guia = (opcao) => opcao.value === '' && /^(selecione|escolha)/i.test(opcao.textContent.trim());
    const partes = [cabecalho, ...[...select.options].filter((opcao) => !guia(opcao)).map(itemDaFolha)];
    if (campo.dataset.folhaRodape) {
      const rodape = document.createElement('div');
      rodape.className = 'seletor__rodape';
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'seletor__rodape-botao';
      botao.textContent = campo.dataset.folhaRodape;
      rodape.append(botao);
      partes.push(rodape);
    }
    const rolagem = lista.scrollTop;
    lista.replaceChildren(...partes);
    lista.scrollTop = rolagem;
    lista.querySelector('.seletor__opcao--escolhida')?.scrollIntoView({ block: 'nearest' });
  }

  function desenhar() {
    if (emFolha) {
      desenharFolha();
      return;
    }
    const itens = [...select.options].map((opcao) => {
      const item = modelo.content.firstElementChild.cloneNode(true);
      item.textContent = opcao.textContent;
      item.dataset.valor = opcao.value;
      item.setAttribute('aria-selected', String(opcao.selected));
      if (opcao.selected) item.classList.add('seletor__opcao--escolhida');
      return item;
    });
    const rolagem = lista.scrollTop;
    lista.replaceChildren(...itens);
    lista.scrollTop = rolagem; // trocar as opções zera a rolagem: devolve e garante a escolhida à vista
    lista.querySelector('.seletor__opcao--escolhida')?.scrollIntoView({ block: 'nearest' });
  }

  function abrir() {
    clearTimeout(temporizador);
    clearTimeout(limpeza);
    if (aberta()) return;
    limpar();
    desenhar();
    lista.classList.add('seletor__lista--aberta');
    select.setAttribute('aria-expanded', 'true');
    posicionar();
  }

  // Cabe no espaço livre: embaixo do campo, ou em cima se faltar espaço embaixo e sobrar em cima. Sempre recalcula do
  // zero (altura padrão primeiro), então volta ao tamanho normal quando a página rola para uma região com espaço.
  // Em folha: fixa a lista no rodapé da janela, com a largura e os cantos de baixo dela (a janela pode ter rolagem própria, então a posição vem
  // da caixa dela na tela). A altura máxima é uma parte da janela, para sobrar o alto dela à vista.
  // O fundo escuro que cobre a tela enquanto a lista está aberta (um por janela, criado na primeira vez, dentro dela: no mesmo contexto de
  // empilhamento da lista, abaixo dela). Só escurece, sem desfocar. Clicar nele fecha a lista.
  function escurecer(ligado) {
    let fundo = janela.__folhaFundo;
    if (!fundo) {
      fundo = document.createElement('div');
      fundo.className = 'seletor__escurecer';
      janela.append(fundo);
      janela.__folhaFundo = fundo;
    }
    if (ligado) fundo.onclick = () => campo.dispatchEvent(new CustomEvent('seletor:fechar'));
    fundo.classList.toggle('seletor__escurecer--ligado', ligado);
  }

  // Em folha: a lista abre no MEIO da tela (centralizada na vertical, pelo CSS), com a largura e a posição horizontal da janela. Assim o usuário
  // vê a lista inteira sem rolar e ela não cola na borda de baixo.
  function posicionarFolha() {
    const caixa = janela.getBoundingClientRect();
    lista.style.setProperty('--folha-esquerda', `${caixa.left}px`);
    lista.style.setProperty('--folha-largura', `${caixa.width}px`);
    lista.style.setProperty('--folha-altura', `${Math.floor(window.innerHeight * 0.7)}px`);
    escurecer(true);
  }

  function posicionar() {
    if (emFolha) {
      posicionarFolha();
      return;
    }
    const rolagem = lista.scrollTop;
    lista.style.removeProperty('--altura-lista');
    lista.classList.remove('seletor__lista--acima');
    const caixa = campo.getBoundingClientRect();
    const natural = lista.scrollHeight; // altura que a lista teria sem limite
    const abaixo = window.innerHeight - caixa.bottom - MARGEM_PX;
    const acima = caixa.top - MARGEM_PX;
    const subir = natural > abaixo && acima > abaixo;
    const espaco = Math.max(subir ? acima : abaixo, ALTURA_MINIMA_PX);
    lista.classList.toggle('seletor__lista--acima', subir);
    if (natural > espaco) lista.style.setProperty('--altura-lista', `${Math.floor(espaco)}px`);
    lista.scrollTop = rolagem; // refazer a altura não pode perder a posição rolada
  }

  function limpar() {
    for (const nome of ['--folha-esquerda', '--folha-largura', '--folha-altura']) lista.style.removeProperty(nome);
    lista.style.removeProperty('--altura-lista');
    lista.classList.remove('seletor__lista--acima');
  }

  function fechar() {
    clearTimeout(temporizador);
    if (!aberta()) return;
    lista.classList.remove('seletor__lista--aberta');
    select.setAttribute('aria-expanded', 'false');
    if (emFolha) escurecer(false);
    // altura e sentido só voltam ao padrão depois do desaparecimento, para a lista não pular durante o fade-out
    limpeza = setTimeout(limpar, DURACAO_FADE_MS);
  }

  function mover(tecla) {
    const ultimo = select.options.length - 1;
    const atual = select.selectedIndex;
    const novo = tecla === 'Home' ? 0 : tecla === 'End' ? ultimo : Math.min(ultimo, Math.max(0, atual + (tecla === 'ArrowDown' ? 1 : -1)));
    if (novo === atual) return;
    select.selectedIndex = novo;
    select.dispatchEvent(new Event('change', { bubbles: true })); // aplica o filtro e a lista marca a nova opção
  }

  function escolher(valor) {
    if (select.value !== valor) {
      select.value = valor;
      select.dispatchEvent(new Event('change', { bubbles: true })); // quem usa o campo reage a este evento
    }
    fechar();
  }

  // O rótulo ("Banco", "Conta"...) não ativa o campo: um clique nele repassaria o clique ao select (abrindo a lista nativa do navegador
  // junto com a nossa). A lista só abre clicando dentro do próprio campo.
  for (const rotulo of campo.querySelectorAll('label')) rotulo.addEventListener('click', (evento) => evento.preventDefault());

  // Mouse: abre depois de uma pequena espera e fecha ao sair, a menos que o campo esteja selecionado por Tab.
  // Campo com o atributo data-ao-clicar (ex.: a janela de novo lançamento) não abre ao passar o mouse: só ao clicar nele.
  if (campo.hasAttribute('data-ao-clicar')) {
    campo.addEventListener('click', (evento) => {
      if (lista.contains(evento.target)) return; // clicar numa opção é com o outro ouvinte (escolher)
      // só o clique em cima da caixa do select abre a lista: o rótulo, um botão que fique dentro do campo (como o Sugerir), a
      // mensagem de erro e o espaço em volta não abrem. O select tem pointer-events: none, então a posição do clique é que diz.
      const caixa = select.getBoundingClientRect();
      const dentro = evento.clientX >= caixa.left && evento.clientX <= caixa.right && evento.clientY >= caixa.top && evento.clientY <= caixa.bottom;
      if (!dentro || evento.target.closest('label, .campo__erro, button:not(select > button)')) return;
      if (aberta()) fechar();
      else abrir();
    });
  } else {
    campo.addEventListener('mouseenter', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(abrir, ESPERA_PARA_ABRIR_MS);
    });
    campo.addEventListener('mouseleave', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (!focoPorTeclado()) fechar();
      }, ESPERA_PARA_FECHAR_MS);
    });
  }

  // Teclado: chegar com Tab abre; sair fecha. (Um foco vindo de clique não abre: quem abre é o mouse sobre o campo.)
  select.addEventListener('focus', () => {
    if (entradaPorTeclado()) abrir();
  });
  select.addEventListener('blur', fechar);
  select.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      // numa janela, o Esc que fecha a lista não pode fechar também a janela (o ouvinte dela está no document)
      if (emFolha && aberta()) evento.stopPropagation();
      fechar();
    } else if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault(); // não abre a lista nativa
      if (aberta()) fechar();
      else abrir();
    } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp' || evento.key === 'Home' || evento.key === 'End') {
      // As setas trocam a opção aqui mesmo: no select personalizável elas abririam a lista nativa e o foco sairia.
      evento.preventDefault();
      mover(evento.key);
    }
  });
  select.addEventListener('change', () => {
    if (aberta()) desenhar(); // as setas trocaram a opção: a lista marca a nova
  });

  // Escolher com o mouse. O mousedown não tira o foco do select.
  lista.addEventListener('mousedown', (evento) => evento.preventDefault());
  lista.addEventListener('click', (evento) => {
    if (evento.target.closest('.seletor__fechar')) {
      fechar();
      return;
    }
    if (evento.target.closest('.seletor__rodape-botao')) {
      fechar();
      campo.dispatchEvent(new CustomEvent('seletor:rodape', { bubbles: true }));
      return;
    }
    const opcao = evento.target.closest('.seletor__opcao');
    if (opcao) escolher(opcao.dataset.valor);
  });

  campo.addEventListener('seletor:fechar', fechar);

  // Rolar a página ou mudar a janela muda o espaço livre: recalcula posição e altura (inclusive voltando ao normal).
  const reposicionar = (evento) => {
    if (evento?.target instanceof Node && lista.contains(evento.target)) return; // rolar a própria lista não reposiciona
    if (aberta()) posicionar();
  };
  window.addEventListener('scroll', reposicionar, { capture: true, passive: true, signal });
  window.addEventListener('resize', reposicionar, { signal });
}
