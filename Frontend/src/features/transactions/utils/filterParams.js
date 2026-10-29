import { dataValida } from '../../../shared/utils/dateRange.js';
import { lerValor } from './formValidation.js';

/**
 * Converte os campos do cartão de filtros nos parâmetros da API (GET /transactions).
 * Campos vazios são ignorados. Devolve `{ erros, parametros }`: `erros` é um mapa campo -> mensagem
 * e `parametros` é null se houver algum erro (a tela mostra as mensagens em vez de consultar).
 */
export function montarParametros(valores) {
  const erros = {};
  const parametros = {};

  const busca = String(valores.busca ?? '').trim();
  if (busca) parametros.busca = busca;

  for (const campo of ['tipo', 'categoria', 'formaPagamento']) {
    if (valores[campo]) parametros[campo] = valores[campo];
  }

  for (const [campo, rotulo] of [['dataInicio', 'Data inicial'], ['dataFim', 'Data final']]) {
    const texto = String(valores[campo] ?? '').trim();
    if (!texto) continue;
    if (dataValida(texto)) parametros[campo] = texto;
    else erros[campo] = `${rotulo} inválida.`;
  }

  for (const campo of ['valorMin', 'valorMax']) {
    const texto = String(valores[campo] ?? '').trim();
    if (!texto) continue;
    const numero = lerValor(texto);
    if (Number.isNaN(numero)) erros[campo] = 'Valor inválido.';
    else parametros[campo] = numero;
  }

  if (parametros.dataInicio && parametros.dataFim && parametros.dataInicio > parametros.dataFim) {
    erros.dataInicio = 'Final antes do início.';
  }
  if (parametros.valorMin !== undefined && parametros.valorMax !== undefined && parametros.valorMin > parametros.valorMax) {
    erros.valorMin = 'Mínimo maior que o máximo.';
  }

  return Object.keys(erros).length > 0 ? { erros, parametros: null } : { erros, parametros };
}
