// Valores em dinheiro, percentuais e datas da API, para as telas que mostram e digitam dinheiro (Metas e Investimentos).

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A API guarda "2026-12-31" como meia-noite UTC; formatar em UTC mantém o dia que o usuário escolheu.
const dataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

/** 1500.5 -> "R$ 1.500,50" */
export function formatarMoeda(valor) {
  return moeda.format(valor);
}

/** 12.5 -> "12,50%" */
export function formatarPercentual(valor) {
  return `${numero.format(valor)}%`;
}

/** "2026-12-31T00:00:00.000Z" -> "31/12/2026" */
export function formatarData(iso) {
  return dataCurta.format(new Date(iso));
}

/** 1234.5 -> "1.234,50": o valor já formatado para preencher um campo com máscara de moeda. */
export function valorParaCampo(valor) {
  return numero.format(valor);
}

/**
 * Converte o texto digitado em número. Aceita "42.9", "42,9" e "1.234,56". Com vírgula, o ponto é separador de milhar;
 * sem vírgula, o ponto é decimal. Devolve NaN se não for um número (zero vale).
 */
export function lerValor(texto) {
  const digitado = String(texto ?? '').trim();
  const normal = digitado.includes(',') ? digitado.replace(/\./g, '').replace(',', '.') : digitado;
  return /^\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}

/** Como lerValor, mas aceita sinal de menos (uma taxa pode ser negativa): "-2,5" -> -2.5. NaN se não for número. */
export function lerTaxa(texto) {
  const digitado = String(texto ?? '').trim();
  const normal = digitado.includes(',') ? digitado.replace(/\./g, '').replace(',', '.') : digitado;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN;
}
