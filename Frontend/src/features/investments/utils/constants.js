// Valores aceitos pela API (docs/contrato-api.md, seção 6) e os textos mostrados na tela.

/** Erros da API com um texto para o usuário; os demais mostram a mensagem da própria API (já em português). */
export const MENSAGENS_DE_ERRO = {
  INSTALLMENT_NOT_FOUND: 'Esse parcelamento não existe mais (talvez já tenha sido removido).',
  JAVA_SERVER_UNAVAILABLE: 'O servidor de cálculos está fora do ar. Tente de novo em instantes.',
};

export const mensagemDeErro = (erro, padrao) => MENSAGENS_DE_ERRO[erro?.code] ?? erro?.message ?? padrao;

/** "12" -> 12; NaN se não for um número inteiro (zero vale). */
export function lerInteiro(texto) {
  const digitado = String(texto ?? '').trim();
  return /^\d+$/.test(digitado) ? Number(digitado) : NaN;
}
