import { dataValida } from '../../../shared/utils/dateRange.js';
import { CATEGORIAS, FORMAS_PAGAMENTO, TIPOS } from './constants.js';

export const LIMITE_OBSERVACOES = 300;

// Mensagem curta de cada campo, mostrada junto dele (também usada para traduzir os erros da API, que vêm em inglês).
export const MENSAGENS_CAMPO = {
  tipo: 'Escolha o tipo.',
  descricao: 'Informe a descrição.',
  valor: 'Informe um valor maior que zero.',
  data: 'Informe uma data válida.',
  categoria: 'Escolha a categoria.',
  formaPagamento: 'Escolha o pagamento.',
  observacoes: `Máximo de ${LIMITE_OBSERVACOES} caracteres.`,
};

/**
 * Converte o texto digitado em número. Aceita "42.9", "42,9" e "1.234,56".
 * Com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é decimal.
 * Devolve NaN se não for um número positivo no formato esperado.
 */
export function lerValor(texto) {
  const digitado = String(texto ?? '').trim();
  const normal = digitado.includes(',') ? digitado.replace(/\./g, '').replace(',', '.') : digitado;
  return /^\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

const estaEm = (lista, valor) => lista.some((item) => item.valor === valor);

/**
 * Confere um campo só (usado pelo formulário e pela edição direta no extrato). Devolve `{ erro, valor }`: `erro` é a
 * mensagem curta (ou null) e `valor` é o valor pronto para a API (número, texto sem espaços nas pontas...).
 */
export function validarCampo(nome, texto) {
  const falha = (mensagem = MENSAGENS_CAMPO[nome]) => ({ erro: mensagem, valor: null });
  const entrada = String(texto ?? '');

  switch (nome) {
    case 'tipo': return estaEm(TIPOS, entrada) ? { erro: null, valor: entrada } : falha();
    case 'descricao': return entrada.trim() ? { erro: null, valor: entrada.trim() } : falha();
    case 'valor': {
      if (!entrada.trim()) return falha('Informe o valor.');
      const numero = lerValor(entrada);
      return numero > 0 ? { erro: null, valor: Math.round(numero * 100) / 100 } : falha('Valor inválido.');
    }
    case 'data': return dataValida(entrada) ? { erro: null, valor: entrada } : falha(entrada ? 'Data inválida.' : undefined);
    case 'categoria': return estaEm(CATEGORIAS, entrada) ? { erro: null, valor: entrada } : falha();
    case 'formaPagamento': return estaEm(FORMAS_PAGAMENTO, entrada) ? { erro: null, valor: entrada } : falha();
    case 'observacoes': {
      const observacoes = entrada.trim();
      return observacoes.length <= LIMITE_OBSERVACOES ? { erro: null, valor: observacoes } : falha();
    }
    default: return falha('Campo desconhecido.');
  }
}

/**
 * Confere os campos do formulário de cadastro.
 * Devolve `{ erros, dados }`: `erros` é um mapa campo -> mensagem; `dados` é o corpo pronto
 * para a API (ou null se houver algum erro). As observações são opcionais.
 */
export function validarFormulario(valores) {
  const erros = {};
  const dados = {};

  for (const nome of ['tipo', 'descricao', 'valor', 'data', 'categoria', 'formaPagamento', 'observacoes']) {
    const { erro, valor } = validarCampo(nome, valores[nome]);
    if (erro) erros[nome] = erro;
    else dados[nome] = valor;
  }

  if (Object.keys(erros).length > 0) return { erros, dados: null };
  if (!dados.observacoes) delete dados.observacoes; // sem observação: o campo nem vai para a API
  return { erros, dados };
}
