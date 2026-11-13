import { MENSAGENS_DE_ERRO } from './constants.js';

/**
 * Texto de tela para um erro de uma chamada: usa a frase combinada para os `code` conhecidos; senão a mensagem da
 * própria API (já em português) ou a do navegador (falha de conexão); senão uma frase genérica.
 */
export function mensagemDeErro(erro, padrao = 'Algo deu errado. Tente de novo.') {
  return MENSAGENS_DE_ERRO[erro?.code] ?? erro?.message ?? padrao;
}
