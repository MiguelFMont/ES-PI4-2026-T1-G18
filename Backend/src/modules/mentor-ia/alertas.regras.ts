// src/modules/mentor-ia/alertas.regras.ts
// Regras que decidem quais alertas o usuário tem hoje. São funções puras: recebem as transações e o
// instante "hoje" (sem banco e sem Date.now()), para poderem ser testadas com qualquer data.
// Os limites abaixo foram ajustados para não gerar nenhum "gasto fora do padrão" com os dados do seed
// (src/database/seeds/transactions.seed.ts) em nenhum dia do ano.
import { diaEmBrasilia, inicioDoDia } from "./datas";

export const TIPOS_ALERTA = ["gasto_fora_do_padrao", "fatura_proxima", "dinheiro_parado"] as const;
export type TipoAlerta = (typeof TIPOS_ALERTA)[number];

// Só os campos de que as regras precisam.
export interface TransacaoParaAlerta {
  tipo: "receita" | "despesa";
  valor: number;
  categoria: string;
  data: Date;
  formaPagamento: string;
}

export interface AlertaCandidato {
  tipo: TipoAlerta;
  // Identifica o alerta no período (ex.: "fatura_proxima:2026-11"): reler os alertas não o duplica.
  chave: string;
  titulo: string;
  mensagem: string;
  dados: Record<string, string | number>;
}

// Meses anteriores (completos) usados como histórico.
export const MESES_DE_HISTORICO = 3;
// Histórico mínimo: meses (dos 3 anteriores) com movimento, para não alertar um usuário novo.
export const MESES_COM_HISTORICO_MINIMO = 2;

// Gasto fora do padrão: o gasto do mês até hoje numa categoria já é pelo menos FATOR vezes o MAIOR gasto
// mensal dela nos 3 meses anteriores, com pelo menos DIFERENCA_MINIMA reais a mais. Comparar o mês
// incompleto com o maior mês completo só erra para menos (o mês ainda pode crescer), e o fator 2 deixa
// folga sobre o maior caso do seed (1,84×).
export const FATOR_GASTO_FORA_DO_PADRAO = 2;
export const DIFERENCA_MINIMA_GASTO = 200;

// Fatura próxima. Ainda não há cartão cadastrado (o Grupo 5 vai simular faturas): a fatura é ESTIMADA
// como a soma das despesas com formaPagamento "credito" do ciclo fechado, supondo vencimento todo dia 10
// e fechamento 7 dias antes (dia 3). Compras a partir do dia do fechamento entram na fatura seguinte.
export const DIA_VENCIMENTO_FATURA = 10;
export const DIAS_ENTRE_FECHAMENTO_E_VENCIMENTO = 7;
export const DIAS_DE_AVISO_FATURA = 5;

// Dinheiro parado: o que sobrou (receitas - despesas) desde o início do 3º mês anterior até hoje é de pelo
// menos SALDO_MINIMO e de pelo menos 1 mês de despesas (média dos meses anteriores), e não há nenhuma
// transação de investimento no período. A mensagem é só educativa: nunca cita ativo ou produto.
export const MESES_DE_DESPESA_PARADOS = 1;
export const SALDO_MINIMO_PARADO = 500;

const NOMES_DOS_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const UM_DIA_MS = 24 * 60 * 60 * 1000;

const emReais = (valor: number) => Math.round(valor * 100) / 100;

// "R$ 1.234,56" (sem depender do ICU do Node, que usa espaço não separável)
export function formatarReais(valor: number): string {
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split(".");
  return `${valor < 0 ? "-" : ""}R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${centavos}`;
}

// "2026-11" (mês 0 a 11; aceita fora da faixa, como o Date)
function chaveDoMes(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// "03/10" a partir do instante da meia-noite de Brasília
function diaEMes(inicio: Date): string {
  const { mes, dia } = diaEmBrasilia(inicio);
  return `${String(dia).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")}`;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function ehInvestimento(categoria: string): boolean {
  return semAcento(categoria).startsWith("investiment");
}

function soma(transacoes: TransacaoParaAlerta[], de: Date, ate: Date, filtro: (t: TransacaoParaAlerta) => boolean) {
  return transacoes
    .filter((t) => t.data >= de && t.data < ate && filtro(t))
    .reduce((total, t) => total + t.valor, 0);
}

export function gastoForaDoPadrao(transacoes: TransacaoParaAlerta[], hoje: Date): AlertaCandidato[] {
  const { ano, mes, dia } = diaEmBrasilia(hoje);
  const inicioDoMes = inicioDoDia(ano, mes, 1);
  const amanha = inicioDoDia(ano, mes, dia + 1);
  const categorias = new Set(transacoes.filter((t) => t.tipo === "despesa").map((t) => t.categoria));
  const alertas: AlertaCandidato[] = [];

  for (const categoria of categorias) {
    const daCategoria = (t: TransacaoParaAlerta) => t.tipo === "despesa" && t.categoria === categoria;
    const atual = soma(transacoes, inicioDoMes, amanha, daCategoria);
    const meses = Array.from({ length: MESES_DE_HISTORICO }, (_, i) =>
      soma(transacoes, inicioDoDia(ano, mes - i - 1, 1), inicioDoDia(ano, mes - i, 1), daCategoria)
    );
    const mesesComGasto = meses.filter((v) => v > 0);
    if (mesesComGasto.length < MESES_COM_HISTORICO_MINIMO) continue;

    const maiorMes = Math.max(...meses);
    if (atual < maiorMes * FATOR_GASTO_FORA_DO_PADRAO || atual - maiorMes < DIFERENCA_MINIMA_GASTO) continue;

    const media = mesesComGasto.reduce((total, v) => total + v, 0) / mesesComGasto.length;
    const vezes = (atual / maiorMes).toFixed(1).replace(".", ",");
    alertas.push({
      tipo: "gasto_fora_do_padrao",
      chave: `gasto_fora_do_padrao:${categoria}:${chaveDoMes(ano, mes)}`,
      titulo: `Gasto fora do padrão em ${categoria}`,
      mensagem:
        `Em ${NOMES_DOS_MESES[mes]} você já gastou ${formatarReais(atual)} com ${categoria}, ${vezes} vezes ` +
        `o maior gasto mensal dessa categoria nos últimos ${MESES_DE_HISTORICO} meses (${formatarReais(maiorMes)}).`,
      dados: {
        categoria,
        valorAtual: emReais(atual),
        maiorMesAnterior: emReais(maiorMes),
        mediaMensal: emReais(media),
      },
    });
  }
  return alertas;
}

export function faturaProxima(transacoes: TransacaoParaAlerta[], hoje: Date): AlertaCandidato[] {
  const { ano, mes, dia } = diaEmBrasilia(hoje);
  // próximo vencimento a partir de hoje (hoje incluído)
  const mesDoVencimento = dia <= DIA_VENCIMENTO_FATURA ? mes : mes + 1;
  const vencimento = inicioDoDia(ano, mesDoVencimento, DIA_VENCIMENTO_FATURA);
  const diasParaVencer = Math.round((vencimento.getTime() - inicioDoDia(ano, mes, dia).getTime()) / UM_DIA_MS);
  if (diasParaVencer > DIAS_DE_AVISO_FATURA) return [];

  const diaDoFechamento = DIA_VENCIMENTO_FATURA - DIAS_ENTRE_FECHAMENTO_E_VENCIMENTO;
  const inicioDoCiclo = inicioDoDia(ano, mesDoVencimento - 1, diaDoFechamento);
  const fechamento = inicioDoDia(ano, mesDoVencimento, diaDoFechamento);
  const valor = soma(transacoes, inicioDoCiclo, fechamento, (t) => t.tipo === "despesa" && t.formaPagamento === "credito");
  if (valor <= 0) return [];

  const quando =
    diasParaVencer === 0 ? "vence hoje" : diasParaVencer === 1 ? "vence amanhã" : `vence em ${diasParaVencer} dias`;
  const ultimoDiaDoCiclo = new Date(fechamento.getTime() - UM_DIA_MS);
  return [
    {
      tipo: "fatura_proxima",
      chave: `fatura_proxima:${chaveDoMes(ano, mesDoVencimento)}`,
      titulo: "Fatura do cartão perto do vencimento",
      mensagem:
        `A fatura do cartão de crédito ${quando} (${diaEMes(vencimento)}): são ${formatarReais(valor)} em compras ` +
        `no crédito de ${diaEMes(inicioDoCiclo)} a ${diaEMes(ultimoDiaDoCiclo)}. Reserve esse valor para não pagar juros.`,
      dados: {
        valor: emReais(valor),
        vencimento: vencimento.toISOString(),
        diasParaVencer,
        inicioDoCiclo: inicioDoCiclo.toISOString(),
        fechamento: fechamento.toISOString(),
      },
    },
  ];
}

export function dinheiroParado(transacoes: TransacaoParaAlerta[], hoje: Date): AlertaCandidato[] {
  const { ano, mes, dia } = diaEmBrasilia(hoje);
  const inicio = inicioDoDia(ano, mes - MESES_DE_HISTORICO, 1);
  const amanha = inicioDoDia(ano, mes, dia + 1);
  const doPeriodo = transacoes.filter((t) => t.data >= inicio && t.data < amanha);
  if (doPeriodo.some((t) => ehInvestimento(t.categoria))) return [];

  // meses anteriores completos que tiveram alguma transação
  const despesasPorMes = Array.from({ length: MESES_DE_HISTORICO }, (_, i) => {
    const de = inicioDoDia(ano, mes - i - 1, 1);
    const ate = inicioDoDia(ano, mes - i, 1);
    const doMes = doPeriodo.filter((t) => t.data >= de && t.data < ate);
    return doMes.length === 0 ? undefined : soma(doMes, de, ate, (t) => t.tipo === "despesa");
  }).filter((v): v is number => v !== undefined);
  if (despesasPorMes.length < MESES_COM_HISTORICO_MINIMO) return [];

  const receitas = soma(doPeriodo, inicio, amanha, (t) => t.tipo === "receita");
  const despesas = soma(doPeriodo, inicio, amanha, (t) => t.tipo === "despesa");
  const saldo = receitas - despesas;
  const despesaMensal = despesasPorMes.reduce((total, v) => total + v, 0) / despesasPorMes.length;
  if (saldo < SALDO_MINIMO_PARADO || saldo < despesaMensal * MESES_DE_DESPESA_PARADOS) return [];

  return [
    {
      tipo: "dinheiro_parado",
      chave: `dinheiro_parado:${chaveDoMes(ano, mes)}`,
      titulo: "Dinheiro parado na conta",
      mensagem:
        `Desde ${diaEMes(inicio)} sobraram ${formatarReais(saldo)} (receitas menos despesas), mais do que você ` +
        `gasta em um mês (${formatarReais(despesaMensal)} em média), e não há nenhum investimento registrado. ` +
        `Se esse dinheiro está parado, considere separar uma reserva de emergência ou estudar opções de investimento.`,
      dados: {
        saldo: emReais(saldo),
        receitas: emReais(receitas),
        despesas: emReais(despesas),
        despesaMensalMedia: emReais(despesaMensal),
        desde: inicio.toISOString(),
      },
    },
  ];
}

// Todos os alertas que valem hoje para essas transações.
export function gerarAlertas(transacoes: TransacaoParaAlerta[], hoje: Date): AlertaCandidato[] {
  return [
    ...gastoForaDoPadrao(transacoes, hoje),
    ...faturaProxima(transacoes, hoje),
    ...dinheiroParado(transacoes, hoje),
  ];
}

// Início do período que as regras leem (do 1º dia do 3º mês anterior): o repositório busca só isso.
export function inicioDoHistorico(hoje: Date): Date {
  const { ano, mes } = diaEmBrasilia(hoje);
  return inicioDoDia(ano, mes - MESES_DE_HISTORICO, 1);
}
