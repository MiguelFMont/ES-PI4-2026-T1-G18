// src/modules/investments/investments.service.ts
import { investmentsRepository } from "./investments.repository";
import { CardDocument, InstallmentDocument, InvestmentDocument } from "./investments.model";
import {
  AtivoParaCalculo,
  CardResponseDto,
  CreateInstallmentDto,
  CreateInvestmentDto,
  InstallmentResponseDto,
  InstallmentsResponseDto,
  InvestmentResponseDto,
  ParcelamentoParaCalculo,
  PedidoCalcularParcelamentos,
  PedidoRentabilidadeSimulada,
  PortfolioResponseDto,
  RespostaCalcularParcelamentos,
  RespostaRentabilidadeSimulada,
  UpdateCardDto,
  UpdateInstallmentDto,
} from "./investments.dto";
import { javaServerClient } from "../../java-client/java-server.client";
import { AppError } from "../../shared/errors/app-error";

const UM_DIA_MS = 24 * 60 * 60 * 1000;

// valores em reais: arredonda em 2 casas para a soma de decimais não deixar "0.30000000000000004"
const emReais = (valor: number) => Math.round(valor * 100) / 100;

const inicioDoDia = (data: Date) => new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
const inicioDoMes = (data: Date) => new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));

// Meses COMPLETOS entre duas datas (a aplicação de 15/01 só completa o 1º mês em 15/02). Nunca negativo.
export function mesesCompletos(desde: Date, ate: Date): number {
  let meses = (ate.getUTCFullYear() - desde.getUTCFullYear()) * 12 + (ate.getUTCMonth() - desde.getUTCMonth());
  if (ate.getUTCDate() < desde.getUTCDate()) meses--;
  return Math.max(0, meses);
}

// Próximo vencimento da fatura: o dia escolhido deste mês, ou do mês seguinte se este já passou.
export function proximoVencimento(diaVencimento: number, hoje: Date): Date {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  return hoje.getUTCDate() <= diaVencimento
    ? new Date(Date.UTC(ano, mes, diaVencimento))
    : new Date(Date.UTC(ano, mes + 1, diaVencimento));
}

// O que o repository devolve (lean) tem _id, mas o tipo gerado pelo Mongoose não o expõe: afirmamos aqui, num lugar só.
type ComId<T> = T & { _id: { toString(): string } };
const comId = <T>(doc: unknown) => doc as ComId<T>;

interface Item<T> {
  id: string;
  doc: T;
}
const comoItem = <T>(doc: unknown): Item<T> => {
  const lido = comId<T>(doc);
  return { id: lido._id.toString(), doc: lido };
};

// ---------------------------------------------------------------------------------------------------- portfólio

async function calcularCarteira(itens: Item<InvestmentDocument>[], agora: Date): Promise<PortfolioResponseDto> {
  const ativos: AtivoParaCalculo[] = itens.map(({ id, doc }) => ({
    id,
    nome: doc.nome,
    tipo: doc.tipo,
    valor: doc.valorInvestido,
    taxaMensal: doc.taxaMensal,
    meses: mesesCompletos(doc.dataAplicacao, agora),
  }));

  const resposta = await javaServerClient.enviarPedido<PedidoRentabilidadeSimulada, RespostaRentabilidadeSimulada>(
    "PedidoRentabilidadeSimulada",
    "RespostaRentabilidadeSimulada",
    { ativos }
  );

  return {
    ativos: resposta.ativos.map((a, i): InvestmentResponseDto => ({
      id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      valorInvestido: a.valor,
      taxaMensal: a.taxaMensal,
      dataAplicacao: itens[i].doc.dataAplicacao.toISOString(),
      mesesRendendo: a.meses,
      valorAtual: a.valorAtual,
      rendimento: a.rendimento,
      rentabilidade: a.rentabilidade,
      percentualCarteira: a.percentualCarteira,
    })),
    totalInvestido: resposta.totalInvestido,
    patrimonio: resposta.patrimonio,
    rendimento: resposta.rendimento,
    rentabilidade: resposta.rentabilidade,
  };
}

// ---------------------------------------------------------------------------------------------------- parcelamentos

async function calcularParcelamentos(itens: Item<InstallmentDocument>[]): Promise<InstallmentsResponseDto> {
  const parcelamentos: ParcelamentoParaCalculo[] = itens.map(({ id, doc }) => ({
    id,
    descricao: doc.descricao,
    valorTotal: doc.valorTotal,
    parcelas: doc.parcelas,
    parcelasPagas: doc.parcelasPagas,
    taxaJurosMensal: doc.taxaJurosMensal,
  }));

  const resposta = await javaServerClient.enviarPedido<PedidoCalcularParcelamentos, RespostaCalcularParcelamentos>(
    "PedidoCalcularParcelamentos",
    "RespostaCalcularParcelamentos",
    { parcelamentos }
  );

  return {
    parcelamentos: resposta.parcelamentos.map((p): InstallmentResponseDto => ({
      id: p.id,
      descricao: p.descricao,
      valorTotal: p.valorTotal,
      parcelas: p.parcelas,
      parcelasPagas: p.parcelasPagas,
      parcelasRestantes: p.parcelasRestantes,
      taxaJurosMensal: p.taxaJurosMensal,
      valorParcela: p.valorParcela,
      saldoDevedor: p.saldoDevedor,
      jurosTotal: p.jurosTotal,
      quitado: p.quitado,
    })),
    totalParcelasDoMes: resposta.totalParcelasDoMes,
    totalSaldoDevedor: resposta.totalSaldoDevedor,
    totalJuros: resposta.totalJuros,
  };
}

// ---------------------------------------------------------------------------------------------------- cartão

async function montarCartao(userId: string, cartao: CardDocument): Promise<CardResponseDto> {
  const agora = new Date();
  const [comprasNoCredito, parcelamentos] = await Promise.all([
    investmentsRepository.somarComprasNoCredito(userId, inicioDoMes(agora), agora),
    investmentsService.listInstallments(userId),
  ]);

  const vencimento = proximoVencimento(cartao.diaVencimento, agora);
  const compras = emReais(comprasNoCredito);

  return {
    limite: cartao.limite,
    diaVencimento: cartao.diaVencimento,
    limiteDisponivel: emReais(cartao.limite - compras - parcelamentos.totalSaldoDevedor),
    fatura: {
      mes: inicioDoMes(agora).toISOString().slice(0, 7),
      valor: emReais(compras + parcelamentos.totalParcelasDoMes),
      comprasNoCredito: compras,
      parcelasDoMes: parcelamentos.totalParcelasDoMes,
      vencimento: vencimento.toISOString().slice(0, 10),
      diasParaVencer: Math.round((vencimento.getTime() - inicioDoDia(agora).getTime()) / UM_DIA_MS),
    },
  };
}

function parcelamentoNaoEncontrado() {
  return new AppError("Parcelamento não encontrado", 404, "INSTALLMENT_NOT_FOUND");
}

export const investmentsService = {
  // ------------------------------------------------------------------------------------------ portfólio
  async listInvestments(userId: string): Promise<PortfolioResponseDto> {
    const ativos = (await investmentsRepository.findInvestments(userId)).map((a) => comoItem<InvestmentDocument>(a));
    return calcularCarteira(ativos, new Date());
  },

  // O rendimento é calculado ANTES de gravar, já com o ativo novo na carteira (para o percentual dele ser o real): se o
  // Servidor Java estiver fora do ar (503), nada é salvo.
  async createInvestment(userId: string, dados: CreateInvestmentDto): Promise<InvestmentResponseDto> {
    const agora = new Date();
    const novo: InvestmentDocument = {
      userId,
      nome: dados.nome,
      tipo: dados.tipo,
      valorInvestido: dados.valorInvestido,
      taxaMensal: dados.taxaMensal,
      dataAplicacao: dados.dataAplicacao ?? inicioDoDia(agora),
    };
    const existentes = (await investmentsRepository.findInvestments(userId)).map((a) => comoItem<InvestmentDocument>(a));
    const carteira = await calcularCarteira([...existentes, { id: "novo", doc: novo }], agora);

    const criado = comId<InvestmentDocument>(await investmentsRepository.createInvestment(novo));
    return { ...carteira.ativos[carteira.ativos.length - 1], id: criado._id.toString() };
  },

  async removeInvestment(userId: string, id: string): Promise<void> {
    if (!(await investmentsRepository.removeInvestment(userId, id))) {
      throw new AppError("Investimento não encontrado", 404, "INVESTMENT_NOT_FOUND");
    }
  },

  // ------------------------------------------------------------------------------------------ cartão
  async getCard(userId: string): Promise<CardResponseDto> {
    return montarCartao(userId, (await investmentsRepository.findOrCreateCard(userId)) as CardDocument);
  },

  async updateCard(userId: string, alteracoes: UpdateCardDto): Promise<CardResponseDto> {
    return montarCartao(userId, (await investmentsRepository.updateCard(userId, alteracoes)) as CardDocument);
  },

  // ------------------------------------------------------------------------------------------ parcelamentos
  async listInstallments(userId: string): Promise<InstallmentsResponseDto> {
    const itens = (await investmentsRepository.findInstallments(userId)).map((p) => comoItem<InstallmentDocument>(p));
    return calcularParcelamentos(itens);
  },

  // Como no portfólio, a conta (e a validação do Servidor) vem antes de gravar.
  async createInstallment(userId: string, dados: CreateInstallmentDto): Promise<InstallmentResponseDto> {
    const novo: InstallmentDocument = { userId, ...dados };
    const { parcelamentos } = await calcularParcelamentos([{ id: "novo", doc: novo }]);

    const criado = comId<InstallmentDocument>(await investmentsRepository.createInstallment(novo));
    return { ...parcelamentos[0], id: criado._id.toString() };
  },

  async updateInstallment(userId: string, id: string, alteracoes: UpdateInstallmentDto): Promise<InstallmentResponseDto> {
    const atual = await investmentsRepository.findInstallment(userId, id);
    if (!atual) throw parcelamentoNaoEncontrado();

    const parcelasPagas = alteracoes.parcelasPagas ?? atual.parcelasPagas;
    if (parcelasPagas > atual.parcelas) {
      throw new AppError("Parcelas pagas não pode passar do total de parcelas", 400, "VALIDATION_ERROR");
    }
    const { parcelamentos } = await calcularParcelamentos([
      { id, doc: { ...atual, ...alteracoes, parcelasPagas } as InstallmentDocument },
    ]);

    if (!(await investmentsRepository.updateInstallment(userId, id, alteracoes))) throw parcelamentoNaoEncontrado();
    return parcelamentos[0];
  },

  async removeInstallment(userId: string, id: string): Promise<void> {
    if (!(await investmentsRepository.removeInstallment(userId, id))) throw parcelamentoNaoEncontrado();
  },
};
