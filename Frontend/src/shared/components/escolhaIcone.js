/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
import { CHAVES_DE_ICONE, CORES_DE_ITEM, svgDoIcone } from '../utils/icones.js';

const NOMES_DOS_ICONES = {
  carteira: 'Carteira', banco: 'Banco', cofrinho: 'Cofrinho', cartao: 'Cartão', cedulas: 'Cédulas', casa: 'Casa',
  mala: 'Viagem', carro: 'Carro', escola: 'Estudos', coracao: 'Saúde', grafico: 'Investimentos', estrela: 'Favorito',
};

/**
 * A escolha de ícone e cor de uma conta, de uma meta ou de um cartão. Monta dentro de `container` (um <div class="campo"> com o título no
 * atributo data-rotulo) uma grade de ícones e uma fileira de cores, as duas com a opção "Padrão" (sem ícone / sem cor: vale o logo do banco ou
 * o visual de antes). As chaves são as do Backend (shared/utils/icones.js). Devolve { ler(), definir({ icone, cor }) }; `ler()` dá
 * { icone, cor } com null no que está em "Padrão".
 */
export function ligarEscolhaIcone(container, { signal } = {}) {
  let icone = null;
  let cor = null;

  const rotulo = document.createElement('span');
  rotulo.className = 'escolha-icone__rotulo';
  rotulo.textContent = container.dataset.rotulo ?? 'Ícone e cor (opcional)';

  const grade = document.createElement('div');
  grade.className = 'escolha-icone__grade';
  grade.setAttribute('role', 'radiogroup');
  grade.setAttribute('aria-label', 'Ícone');

  const botaoIcone = (chave, nome, conteudo) => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'escolha-icone__item';
    botao.setAttribute('role', 'radio');
    botao.setAttribute('aria-label', nome);
    botao.title = nome;
    botao.dataset.icone = chave;
    if (typeof conteudo === 'string') botao.innerHTML = conteudo; // desenho fixo do projeto (icones.js)
    else botao.append(conteudo);
    return botao;
  };

  const padrao = document.createElement('span');
  padrao.className = 'escolha-icone__padrao';
  padrao.textContent = 'Aa';
  const botoes = [botaoIcone('', 'Padrão (sem ícone)', padrao), ...CHAVES_DE_ICONE.map((c) => botaoIcone(c, NOMES_DOS_ICONES[c] ?? c, svgDoIcone(c)))];
  grade.append(...botoes);

  const fileira = document.createElement('div');
  fileira.className = 'escolha-icone__cores';
  fileira.setAttribute('role', 'radiogroup');
  fileira.setAttribute('aria-label', 'Cor');
  const pontos = ['', ...CORES_DE_ITEM].map((nome) => {
    const ponto = document.createElement('button');
    ponto.type = 'button';
    ponto.className = 'escolha-icone__cor' + (nome === '' ? ' escolha-icone__cor--padrao' : '');
    ponto.setAttribute('role', 'radio');
    ponto.setAttribute('aria-label', nome === '' ? 'Cor padrão' : `Cor ${nome}`);
    ponto.title = nome === '' ? 'Cor padrão' : nome;
    ponto.dataset.cor = nome;
    if (nome) ponto.style.setProperty('--ponto', `var(--matiz-${nome})`);
    return ponto;
  });
  fileira.append(...pontos);

  container.replaceChildren(rotulo, grade, fileira);

  function pintar() {
    container.style.setProperty('--escolha-cor', cor ? `var(--matiz-${cor})` : 'var(--destaque)');
    for (const botao of botoes) {
      const marcado = (botao.dataset.icone || null) === icone;
      botao.setAttribute('aria-checked', String(marcado));
      botao.classList.toggle('escolha-icone__item--marcado', marcado);
    }
    for (const ponto of pontos) {
      const marcado = (ponto.dataset.cor || null) === cor;
      ponto.setAttribute('aria-checked', String(marcado));
      ponto.classList.toggle('escolha-icone__cor--marcada', marcado);
    }
  }

  grade.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.escolha-icone__item');
    if (!botao) return;
    icone = botao.dataset.icone || null;
    pintar();
  }, { signal });
  fileira.addEventListener('click', (evento) => {
    const ponto = evento.target.closest('.escolha-icone__cor');
    if (!ponto) return;
    cor = ponto.dataset.cor || null;
    pintar();
  }, { signal });

  pintar();
  return {
    ler: () => ({ icone, cor }),
    definir(valores = {}) {
      icone = CHAVES_DE_ICONE.includes(valores.icone) ? valores.icone : null;
      cor = CORES_DE_ITEM.includes(valores.cor) ? valores.cor : null;
      pintar();
    },
  };
}
