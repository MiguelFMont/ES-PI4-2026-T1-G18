const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** 1500.5, 'BRL' -> "R$ 1.500,50". Se a moeda não for reconhecida, usa o real. */
export function formatarSaldo(valor, moeda = 'BRL') {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(valor);
  } catch {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }
}

/** "2026-11-12T15:30:00.000Z" -> "12/11/2026 12:30" (no fuso de quem está vendo). */
export function formatarDataHora(iso) {
  return dataHora.format(new Date(iso));
}
