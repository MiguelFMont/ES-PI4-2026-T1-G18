// src/modules/mentor-ia/__tests__/seed.ts
// Os EXEMPLOS do seed de transações (transactions.seed.dados.ts) recriados para um "hoje" simulado.
// O seed usa meio-dia no fuso da máquina (setHours(12)), o que depende de onde roda; aqui a data é
// montada de forma determinística como meio-dia de Brasília de `diasAtras` dias antes do dia de hoje
// em Brasília: é o que o seed grava numa máquina no horário de Brasília (npm run seed:transacoes no Brasil).
import { diaEmBrasilia, inicioDoDia } from "../datas";
import { EXEMPLOS } from "../../../database/seeds/transactions.seed.dados";
import type { TransactionDocument } from "../../transactions/transactions.model";

const MEIO_DIA_MS = 12 * 60 * 60 * 1000;

export type TransacaoDoSeed = Omit<TransactionDocument, "userId" | "origem">;

export function seedEm(hoje: Date): TransacaoDoSeed[] {
  const { ano, mes, dia } = diaEmBrasilia(hoje);
  return EXEMPLOS.map(({ diasAtras, ...resto }) => ({
    ...resto,
    data: new Date(inicioDoDia(ano, mes, dia - diasAtras).getTime() + MEIO_DIA_MS),
  }));
}
