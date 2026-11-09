// src/modules/mentor-ia/datas.ts
// O mês e o dia do usuário são os de Brasília (UTC-3, sem horário de verão desde 2019), não os do servidor.
export const FUSO_BRASILIA_MS = 3 * 60 * 60 * 1000;

export interface DiaEmBrasilia {
  ano: number;
  mes: number; // 0 a 11, como no Date
  dia: number;
}

export function diaEmBrasilia(instante: Date): DiaEmBrasilia {
  const local = new Date(instante.getTime() - FUSO_BRASILIA_MS); // campos UTC = data/hora de Brasília
  return { ano: local.getUTCFullYear(), mes: local.getUTCMonth(), dia: local.getUTCDate() };
}

// Instante da meia-noite de Brasília daquele dia. Mês e dia fora da faixa "transbordam" como no Date.UTC
// (mes -1 = dezembro do ano anterior, dia 0 = último dia do mês anterior).
export function inicioDoDia(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes, dia) + FUSO_BRASILIA_MS);
}

// Início do mês atual (dia 1, meia-noite de Brasília) e o dia de hoje.
export function mesAtualEmBrasilia(agora = new Date()) {
  const { ano, mes, dia } = diaEmBrasilia(agora);
  return { inicio: inicioDoDia(ano, mes, 1), diaDoMes: dia };
}
