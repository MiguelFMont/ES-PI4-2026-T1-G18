const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const diaEHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Horário de uma mensagem: "14:32" se for de hoje, "28/10, 14:32" se for de outro dia. */
export function formatarHorario(iso) {
  const data = new Date(iso);
  return data.toDateString() === new Date().toDateString() ? hora.format(data) : diaEHora.format(data);
}
