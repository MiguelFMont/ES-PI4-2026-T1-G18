import { apiFetch } from '../../../core/http/api.js';

/**
 * Lista uma página de transações do usuário (GET /transactions).
 * `filtros` aceita pagina, limite, categoria, origem, dataInicio, dataFim, valorMin e valorMax;
 * valores vazios são ignorados. Resposta: { itens, pagina, limite, total, totalPaginas }.
 */
export function listarTransacoes(filtros = {}) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') params.set(chave, String(valor));
  }
  const consulta = params.toString();
  return apiFetch(consulta ? `/transactions?${consulta}` : '/transactions');
}

/**
 * Cadastra uma transação (POST /transactions).
 * `dados`: { tipo, valor, data, descricao, categoria?, formaPagamento? }. Devolve a transação criada.
 */
export function criarTransacao(dados) {
  return apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}

// O Backend aceita até 100 itens por chamada em lote; acima disso o service envia em blocos e soma os resultados.
const LIMITE_LOTE = 100;

async function emBlocos(lista, enviar) {
  const total = { afetadas: 0, naoEncontradas: [] };
  for (let inicio = 0; inicio < lista.length; inicio += LIMITE_LOTE) {
    const resultado = await enviar(lista.slice(inicio, inicio + LIMITE_LOTE));
    total.afetadas += resultado.afetadas;
    total.naoEncontradas.push(...resultado.naoEncontradas);
  }
  return total;
}

/**
 * Edita transações (PATCH /transactions/bulk); para uma só, mande um item. `itens` é uma lista de
 * { id, alteracoes }, em que `alteracoes` leva só os campos que mudaram (observacoes "" apaga a observação).
 * Devolve { afetadas, naoEncontradas: [ids] }; o lote não é tudo ou nada.
 */
export function atualizarTransacoesEmLote(itens) {
  return emBlocos(itens, (bloco) =>
    apiFetch('/transactions/bulk', { method: 'PATCH', body: JSON.stringify({ itens: bloco }) })
  );
}

/**
 * Duplica transações manuais (POST /transactions/:id/duplicate, uma chamada por id, em sequência). A cópia leva os mesmos
 * dados, com a data de hoje. Devolve { afetadas, naoEncontradas: [ids], copias: [transações novas] } no mesmo formato do
 * lote; qualquer outro erro (rede, 422...) interrompe e segue para quem chamou.
 */
export async function duplicarTransacoes(ids) {
  const resultado = { afetadas: 0, naoEncontradas: [], copias: [] };
  for (const id of ids) {
    try {
      resultado.copias.push(await apiFetch(`/transactions/${encodeURIComponent(id)}/duplicate`, { method: 'POST' }));
      resultado.afetadas += 1;
    } catch (erro) {
      if (erro?.code !== 'TRANSACTION_NOT_FOUND') throw erro; // outro 404 (rota inexistente, por exemplo) não é "já excluída"
      resultado.naoEncontradas.push(id);
    }
  }
  return resultado;
}

/** Exclui transações (POST /transactions/bulk-delete); para uma só, mande um id. Devolve { afetadas, naoEncontradas: [ids] }. */
export function excluirTransacoesEmLote(ids) {
  return emBlocos(ids, (bloco) =>
    apiFetch('/transactions/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: bloco }) })
  );
}
