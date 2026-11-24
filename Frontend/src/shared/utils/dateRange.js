const DATA_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** "AAAA-MM-DD" que existe no calendário (rejeita 2026-02-31). */
export function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texto ?? ''))) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

/** Date (no fuso do usuário) -> "AAAA-MM-DD". */
export function isoDeData(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** "AAAA-MM-DD" -> "dd/mm/aaaa" (vazio se não houver data). */
export function isoParaBr(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = String(iso).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Máscara de digitação: "01102026" -> "01/10/2026" (só dígitos, até 8). */
export function mascararData(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/** Lê uma data "dd/mm/aaaa". Devolve `{ iso, valida }`: campo vazio é válido e dá `iso` vazio. */
export function lerData(texto) {
  const digitado = String(texto ?? '').trim();
  if (!digitado) return { iso: '', valida: true };

  const partes = DATA_BR.exec(digitado);
  if (!partes) return { iso: '', valida: false };
  const iso = `${partes[3]}-${partes[2].padStart(2, '0')}-${partes[1].padStart(2, '0')}`;
  return dataValida(iso) ? { iso, valida: true } : { iso: '', valida: false };
}

/**
 * Lê as duas caixas do campo Período ("Início" e "Final"). Devolve `{ dataInicio, dataFim, erro }` com as
 * datas em "AAAA-MM-DD" (vazias se a caixa estiver vazia). `erro` é um texto curto (data inválida, ou data final
 * anterior à inicial) ou null; com erro, as datas voltam vazias e nenhuma caixa é alterada.
 */
export function lerPeriodo(textoInicio, textoFim) {
  const inicio = lerData(textoInicio);
  const fim = lerData(textoFim);

  if (!inicio.valida) return { dataInicio: '', dataFim: '', erro: 'Data inicial inválida.' };
  if (!fim.valida) return { dataInicio: '', dataFim: '', erro: 'Data final inválida.' };

  if (inicio.iso && fim.iso && inicio.iso > fim.iso) {
    return { dataInicio: '', dataFim: '', erro: 'Final antes do início.' };
  }
  return { dataInicio: inicio.iso, dataFim: fim.iso, erro: null };
}

/** Do primeiro ao último dia do mês de `hoje`, em "AAAA-MM-DD". */
export function mesAtual(hoje = new Date()) {
  return {
    inicio: isoDeData(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: isoDeData(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  };
}

/**
 * Períodos prontos do calendário: 'hoje', 'ontem', '7-dias' e '30-dias' (os últimos dias, terminando hoje),
 * 'mes-atual' e 'mes-passado' (do dia 1 ao último dia do mês), 'ano-atual' (de 1º de janeiro a 31 de dezembro)
 * e 'tudo' (sem datas: `inicio` e `fim` vazios, ou seja, sem filtro de período).
 * Devolve `{ inicio, fim }` em "AAAA-MM-DD", ou null se a chave for desconhecida.
 */
export function periodoPredefinido(chave, hoje = new Date()) {
  const dia = (diasAtras) => isoDeData(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasAtras));

  switch (chave) {
    case 'hoje': return { inicio: dia(0), fim: dia(0) };
    case 'ontem': return { inicio: dia(1), fim: dia(1) };
    case '7-dias': return { inicio: dia(6), fim: dia(0) };
    case '30-dias': return { inicio: dia(29), fim: dia(0) };
    case 'mes-atual': return mesAtual(hoje);
    case 'mes-passado': return mesAtual(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
    case 'ano-atual': return { inicio: isoDeData(new Date(hoje.getFullYear(), 0, 1)), fim: isoDeData(new Date(hoje.getFullYear(), 11, 31)) };
    case 'tudo': return { inicio: '', fim: '' };
    default: return null;
  }
}
