/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// Regras do ciclo da fatura do cartão de crédito, em funções puras (sem banco). A fatura FECHA no `diaFechamento` e VENCE 7 dias depois.
// Uma compra feita até o dia do fechamento (inclusive) entra na fatura que fecha neste mês; uma compra feita depois entra na do mês seguinte
// (fechamento dia 15: a compra de 16/11 vai para a fatura que fecha em 15/12). Todas as datas são UTC, como as dos lançamentos.
import { DIAS_DO_FECHAMENTO_AO_VENCIMENTO } from "../../modules/investments/investments.model";

export const UM_DIA_MS = 86_400_000;

export const inicioDoDia = (data: Date) => new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));

/** O fechamento que recebe uma compra feita em `data`: o do mês dela se ela é até o dia do fechamento; senão o do mês seguinte. */
export function fechamentoDaCompra(data: Date, diaFechamento: number): Date {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth();
  return data.getUTCDate() <= diaFechamento
    ? new Date(Date.UTC(ano, mes, diaFechamento))
    : new Date(Date.UTC(ano, mes + 1, diaFechamento));
}

/** O fechamento do mês anterior ao de `fechamento`. */
export function fechamentoAnterior(fechamento: Date, diaFechamento: number): Date {
  return new Date(Date.UTC(fechamento.getUTCFullYear(), fechamento.getUTCMonth() - 1, diaFechamento));
}

/** O primeiro dia da fatura que fecha em `fechamento`: o dia seguinte ao fechamento anterior. */
export function inicioDaFatura(fechamento: Date, diaFechamento: number): Date {
  return new Date(fechamentoAnterior(fechamento, diaFechamento).getTime() + UM_DIA_MS);
}

/** A fatura vence 7 dias depois de fechar. */
export function vencimentoDoFechamento(fechamento: Date): Date {
  return new Date(fechamento.getTime() + DIAS_DO_FECHAMENTO_AO_VENCIMENTO * UM_DIA_MS);
}

export interface DespesaParaSaldo {
  valor: number;
  data: Date;
  formaPagamento?: string;
  parcelas?: number;
}

/**
 * Quanto de uma despesa já saiu do saldo da conta em `hoje`:
 * - despesa comum (ou crédito sem cartão): o valor inteiro quando a data dela chega; antes disso, nada;
 * - compra no crédito: só quando a fatura VENCE (fechamento + 7 dias). Uma compra parcelada em n vezes tira 1/n a cada vencimento
 *   (a parcela k cai na fatura k meses depois).
 */
export function valorJaDescontado(despesa: DespesaParaSaldo, diaFechamentoDoCartao: number | undefined, hoje: Date): number {
  const dia = inicioDoDia(hoje).getTime();
  if (despesa.formaPagamento !== "credito" || diaFechamentoDoCartao === undefined) {
    return inicioDoDia(despesa.data).getTime() <= dia ? despesa.valor : 0;
  }

  const parcelas = despesa.parcelas && despesa.parcelas > 1 ? despesa.parcelas : 1;
  const primeiro = fechamentoDaCompra(despesa.data, diaFechamentoDoCartao);
  let pagas = 0;
  for (let k = 0; k < parcelas; k++) {
    const fechamento = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + k, diaFechamentoDoCartao));
    if (vencimentoDoFechamento(fechamento).getTime() <= dia) pagas++;
  }
  return (despesa.valor / parcelas) * pagas;
}
