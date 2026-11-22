// Valores aceitos pela API (ver docs/contrato-api.md, seção 2). O `valor` é o que vai para o
// Backend; o `rotulo` é o texto mostrado na tela.

export const TIPOS = [
  { valor: 'despesa', rotulo: 'Despesa', cor: 'vermelho' },
  { valor: 'receita', rotulo: 'Receita', cor: 'verde' },
];

export const CATEGORIAS = [
  { valor: 'Alimentacao', rotulo: 'Alimentação', cor: 'laranja' },
  { valor: 'Transporte', rotulo: 'Transporte', cor: 'azul' },
  { valor: 'Moradia', rotulo: 'Moradia', cor: 'roxo' },
  { valor: 'Saude', rotulo: 'Saúde', cor: 'rosa' },
  { valor: 'Lazer', rotulo: 'Lazer', cor: 'ambar' },
  { valor: 'Educacao', rotulo: 'Educação', cor: 'turquesa' },
  { valor: 'Salario', rotulo: 'Salário', cor: 'verde' },
  { valor: 'Outros', rotulo: 'Outros', cor: 'cinza' },
];

export const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', rotulo: 'Dinheiro', cor: 'verde' },
  { valor: 'pix', rotulo: 'Pix', cor: 'turquesa' },
  { valor: 'debito', rotulo: 'Cartão de débito', cor: 'azul' },
  { valor: 'credito', rotulo: 'Cartão de crédito', cor: 'roxo' },
  { valor: 'boleto', rotulo: 'Boleto', cor: 'ambar' },
  { valor: 'outro', rotulo: 'Outro', cor: 'cinza' },
];

/** A cor (nome do matiz, ver core/styles/global.css) de um valor da lista; vazio se a lista não tiver cor. */
export function corDe(lista, valor) {
  return lista.find((item) => item.valor === valor)?.cor ?? 'cinza';
}

/** Texto de tela para um valor da API; se não conhecer o valor, mostra o próprio valor. */
export function rotuloDe(lista, valor) {
  return lista.find((item) => item.valor === valor)?.rotulo ?? valor;
}
