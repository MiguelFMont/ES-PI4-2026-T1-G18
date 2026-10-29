// Valores aceitos pela API (ver docs/contrato-api.md, seção 2). O `valor` é o que vai para o
// Backend; o `rotulo` é o texto mostrado na tela.

export const TIPOS = [
  { valor: 'despesa', rotulo: 'Despesa' },
  { valor: 'receita', rotulo: 'Receita' },
];

export const CATEGORIAS = [
  { valor: 'Alimentacao', rotulo: 'Alimentação' },
  { valor: 'Transporte', rotulo: 'Transporte' },
  { valor: 'Moradia', rotulo: 'Moradia' },
  { valor: 'Saude', rotulo: 'Saúde' },
  { valor: 'Lazer', rotulo: 'Lazer' },
  { valor: 'Educacao', rotulo: 'Educação' },
  { valor: 'Salario', rotulo: 'Salário' },
  { valor: 'Outros', rotulo: 'Outros' },
];

export const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'debito', rotulo: 'Cartão de débito' },
  { valor: 'credito', rotulo: 'Cartão de crédito' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'outro', rotulo: 'Outro' },
];

/** Texto de tela para um valor da API; se não conhecer o valor, mostra o próprio valor. */
export function rotuloDe(lista, valor) {
  return lista.find((item) => item.valor === valor)?.rotulo ?? valor;
}
