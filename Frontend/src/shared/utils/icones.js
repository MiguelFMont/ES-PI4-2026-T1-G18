/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// Ícones das opções das listas que sobem do rodapé das janelas (shared/components/seletor.js): um por categoria, forma de pagamento e tipo.
// Quem usa põe no <select> o atributo data-icones="categoria" (ou "pagamento" ou "tipo"); o seletor procura aqui o ícone pelo valor da opção.
// Os desenhos são traços simples de 24x24 (texto fixo do projeto, nunca vindo da API). A cor é o matiz da opção (global.css).

const tracado = (corpo) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;

const DESENHOS = {
  // categorias
  talher: tracado('<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 1.5-3 4-3 7 0 1.6 1 2.5 3 3v8"/>'),
  carro: tracado('<path d="M5 16V12l1.8-4.5A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.5L19 12v4M5 16h14M5 16v2.5M19 16v2.5"/><circle cx="8" cy="13.5" r="0.9" fill="currentColor"/><circle cx="16" cy="13.5" r="0.9" fill="currentColor"/>'),
  casa: tracado('<path d="M4 11l8-7 8 7M6 10v9.5h12V10M10 19.5v-5h4v5"/>'),
  coracao: tracado('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/><path d="M8 12h2l1.2-2 1.600 4 1.200-2H16"/>'),
  ingresso: tracado('<path d="M4 8.5a2 2 0 0 0 0 3.500v2.500a1.500 1.500 0 0 0 1.500 1.500h13a1.500 1.500 0 0 0 1.500-1.500V12a2 2 0 0 0 0-3.500V6.500A1.500 1.500 0 0 0 18.500 5h-13A1.500 1.500 0 0 0 4 6.500z"/><path d="M14 5v14" stroke-dasharray="1.500 2.500"/>'),
  capelo: tracado('<path d="M3 9l9-4.500L21 9l-9 4.500z"/><path d="M7 11.500v4c0 1.200 2.200 2.500 5 2.500s5-1.300 5-2.500v-4M21 9v5"/>'),
  cedulas: tracado('<rect x="3" y="6.500" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.500"/><path d="M6.500 12h.01M17.500 12h.01"/>'),
  reticencias: tracado('<circle cx="6" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="18" cy="12" r="1.300" fill="currentColor"/>'),
  // pagamentos
  pix: tracado('<path d="M12 3l9 9-9 9-9-9z"/><path d="M9 12l3-3 3 3-3 3z"/>'),
  cartao: tracado('<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M3 10h18M7 15h3"/>'),
  cartaoCredito: tracado('<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M3 9.500h18"/><rect x="6" y="13" width="4" height="2.500" rx="0.600"/>'),
  boleto: tracado('<path d="M4 6v12M7 6v12M10.500 6v12M13 6v12M16.500 6v12M20 6v12"/>'),
  // tipos
  despesa: tracado('<circle cx="12" cy="12" r="8.500"/><path d="M8.500 15.500l7-7M10.500 8.500h5v5"/>'),
  receita: tracado('<circle cx="12" cy="12" r="8.500"/><path d="M15.500 8.500l-7 7M13.500 15.500h-5v-5"/>'),
  transferencia: tracado('<path d="M4 8h14M14.500 4.500L18 8l-3.500 3.500M20 16H6M9.500 12.500L6 16l3.500 3.500"/>'),
};

// valor da opção -> desenho e matiz (os nomes de cor são os de core/styles/global.css: --matiz-azul, --matiz-laranja...)
const GRUPOS = {
  categoria: {
    Alimentacao: ['talher', 'laranja'],
    Transporte: ['carro', 'azul'],
    Moradia: ['casa', 'roxo'],
    Saude: ['coracao', 'rosa'],
    Lazer: ['ingresso', 'ambar'],
    Educacao: ['capelo', 'turquesa'],
    Salario: ['cedulas', 'verde'],
    Outros: ['reticencias', 'cinza'],
  },
  pagamento: {
    dinheiro: ['cedulas', 'verde'],
    pix: ['pix', 'turquesa'],
    debito: ['cartao', 'azul'],
    credito: ['cartaoCredito', 'roxo'],
    boleto: ['boleto', 'ambar'],
    outro: ['reticencias', 'cinza'],
  },
  tipo: {
    despesa: ['despesa', 'vermelho'],
    receita: ['receita', 'verde'],
    transferencia: ['transferencia', 'azul'],
  },
};

/** O ícone de uma opção: { svg, cor } ou null se o grupo ou o valor não tiver ícone (por exemplo, "Selecione..."). */
export function iconeDaOpcao(grupo, valor) {
  const par = GRUPOS[grupo]?.[valor];
  return par ? { svg: DESENHOS[par[0]], cor: par[1] } : null;
}

// ---------------------------------------------------------------- ícone de uma conta, de uma meta ou de um cartão
// A lista de chaves é a do Backend (Backend/src/shared/aparencia/aparencia.ts): o Backend só guarda e valida a chave, o desenho mora aqui.
// Os matizes são os de core/styles/global.css (--matiz-azul, --matiz-roxo...).
const DESENHOS_DE_ITEM = {
  carteira: tracado('<path d="M4 7.500A2.500 2.500 0 0 1 6.500 5H18v3"/><path d="M4 7.500V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.500A2.500 2.500 0 0 1 4 7.500z"/><circle cx="16" cy="13.500" r="1" fill="currentColor"/>'),
  banco: tracado('<path d="M3 9.500L12 4l9 5.500M5 10v7M9.500 10v7M14.500 10v7M19 10v7M3.500 20h17M3 9.500h18"/>'),
  cofrinho: tracado('<path d="M5 12.500c0-3 2.700-5.500 6.500-5.500 1.500 0 2.800.4 3.800 1L18.500 7v3.200c.9.800 1.500 1.800 1.500 3 0 3-2.700 5.300-6 5.300H11c-3.300 0-6-2.300-6-5z"/><path d="M8 18.500V20M14 18.500V20M15.500 11.500h.01M10 7V5.500M11.500 3.500v3M9 12h3"/>'),
  cartao: DESENHOS.cartao,
  cedulas: DESENHOS.cedulas,
  casa: DESENHOS.casa,
  mala: tracado('<rect x="4" y="8" width="16" height="11.500" rx="2"/><path d="M9 8V6.500A1.500 1.500 0 0 1 10.500 5h3A1.500 1.500 0 0 1 15 6.500V8M4 13h16M11 13v1.500h2V13"/>'),
  carro: DESENHOS.carro,
  escola: DESENHOS.capelo,
  coracao: DESENHOS.coracao,
  grafico: tracado('<path d="M4 4v16h16"/><path d="M8 15l3.500-4 3 2.500L19 8M15.500 8H19v3.500"/>'),
  estrela: tracado('<path d="M12 4l2.500 5.200 5.500.8-4 4 1 5.500-5-2.700-5 2.700 1-5.500-4-4 5.500-.8z"/>'),
};

/** As chaves de ícone aceitas (as mesmas do Backend), na ordem em que aparecem na escolha. */
export const CHAVES_DE_ICONE = Object.keys(DESENHOS_DE_ITEM);

/** Os matizes que se podem escolher (os mesmos do Backend). */
export const CORES_DE_ITEM = ['azul', 'roxo', 'rosa', 'laranja', 'ambar', 'turquesa', 'verde', 'vermelho', 'cinza'];

/** O desenho (SVG, texto fixo do projeto) de uma chave de ícone, ou null se a chave não existe. */
export const svgDoIcone = (chave) => DESENHOS_DE_ITEM[chave] ?? null;
