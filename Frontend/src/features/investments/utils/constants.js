/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// Valores aceitos pela API (docs/contrato-api.md, seção 6) e os textos mostrados na tela.

/** Erros da API com um texto para o usuário; os demais mostram a mensagem da própria API (já em português). */
/** Máximo de cartões por usuário (o Backend recusa o sexto com CARD_LIMIT_REACHED). */
export const MAX_CARTOES = 5;

export const MENSAGENS_DE_ERRO = {
  CARD_NOT_FOUND: 'Esse cartão não existe mais (talvez já tenha sido excluído).',
  CARD_LIMIT_REACHED: `Você já tem ${MAX_CARTOES} cartões. Exclua um para adicionar outro.`,
  CARD_NAME_TAKEN: 'Já existe um cartão com esse nome.',
  CARD_REQUIRED: 'Para parcelar uma compra, cadastre um cartão na aba Cartão.',
  ACCOUNT_NOT_FOUND: 'Essa conta não existe mais. Escolha outra.',
  UNDO_NOT_FOUND: 'Não há mais nada para desfazer: o prazo acabou.',
  INSTALLMENT_FROM_TRANSACTION: 'Parcelamento de uma compra: exclua a transação para removê-lo.',
  INSTALLMENT_NOT_FOUND: 'Esse parcelamento não existe mais (talvez já tenha sido removido).',
  JAVA_SERVER_UNAVAILABLE: 'O servidor de cálculos está fora do ar. Tente de novo em instantes.',
};

export const mensagemDeErro = (erro, padrao) => MENSAGENS_DE_ERRO[erro?.code] ?? erro?.message ?? padrao;

/** "12" -> 12; NaN se não for um número inteiro (zero vale). */
export function lerInteiro(texto) {
  const digitado = String(texto ?? '').trim();
  return /^\d+$/.test(digitado) ? Number(digitado) : NaN;
}
