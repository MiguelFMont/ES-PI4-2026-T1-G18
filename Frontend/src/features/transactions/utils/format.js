const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// A API guarda "2026-10-05" como meia-noite UTC; formatar em UTC mantém o dia que o usuário digitou.
const dataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

/** 1500.5 -> "R$ 1.500,50" */
export function formatarMoeda(valor) {
  return moeda.format(valor);
}

/** "2026-10-05T12:00:00.000Z" -> "05/10/2026" */
export function formatarData(iso) {
  return dataCurta.format(new Date(iso));
}

/** Data de hoje (no fuso do usuário) no formato "AAAA-MM-DD", como o campo de data espera. */
export function dataDeHoje() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}
