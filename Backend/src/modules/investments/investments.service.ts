// src/modules/investments/investments.service.ts
import { investmentsRepository } from "./investments.repository";
import { CardDocument, DIAS_DO_FECHAMENTO_AO_VENCIMENTO, InstallmentDocument, InvestmentDocument, MAX_CARTOES } from "./investments.model";
import {
  AtivoParaCalculo,
  CardResponseDto,
  CardsResponseDto,
  CreateCardDto,
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

// Próximo fechamento da fatura: o dia escolhido deste mês, ou do mês seguinte se este já passou.
export function proximoFechamento(diaFechamento: number, hoje: Date): Date {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  return hoje.getUTCDate() <= diaFechamento
    ? new Date(Date.UTC(ano, mes, diaFechamento))
    : new Date(Date.UTC(ano, mes + 1, diaFechamento));
}

// A fatura vence 7 dias depois de fechar.
export function vencimentoDoFechamento(fechamento: Date): Date {
  return new Date(fechamento.getTime() + DIAS_DO_FECHAMENTO_AO_VENCIMENTO * UM_DIA_MS);
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

// O que a resposta precisa além do que o Servidor Java calcula: o cartão padrão (dono dos parcelamentos antigos, sem
// cartaoId) e, dos parcelamentos que nasceram de uma compra, o id da transação.
interface ContextoParcelamentos {
  padraoId: string;
  transacoes: Map<string, string>;
  // a data da compra de cada parcelamento que nasceu de uma transação (os outros contam a partir de quando foram criados)
  datas: Map<string, Date>;
}

// As parcelas avançam sozinhas com o calendário: a cada virada de mês, uma parcela a mais está paga (a do mês corrente
// ainda é a "atual", que entra na fatura). Vale o maior entre o que foi gravado e o que o tempo já pagou, limitado ao total.
const mesesEntre = (de: Date, ate: Date) => (ate.getUTCFullYear() - de.getUTCFullYear()) * 12 + (ate.getUTCMonth() - de.getUTCMonth());

function parcelasPagasPelaData({ id, doc }: Item<InstallmentDocument>, datas: Map<string, Date>, agora: Date): number {
  const inicio = datas.get(id) ?? (doc as { createdAt?: Date }).createdAt;
  if (!inicio) return doc.parcelasPagas;
  return Math.min(doc.parcelas, Math.max(doc.parcelasPagas, mesesEntre(new Date(inicio), agora)));
}

async function contextoDeParcelamentos(userId: string, ids: string[]): Promise<ContextoParcelamentos> {
  const [padrao, transacoes, datas] = await Promise.all([
    investmentsRepository.findOldestCard(userId),
    investmentsRepository.transacoesDosParcelamentos(userId, ids),
    investmentsRepository.datasDasCompras(userId, ids),
  ]);
  return { padraoId: comId<CardDocument>(padrao)._id.toString(), transacoes, datas };
}

async function calcularParcelamentos(
  itens: Item<InstallmentDocument>[],
  contexto: ContextoParcelamentos
): Promise<InstallmentsResponseDto> {
  const agora = new Date();
  const parcelamentos: ParcelamentoParaCalculo[] = itens.map((item) => ({
    id: item.id,
    descricao: item.doc.descricao,
    valorTotal: item.doc.valorTotal,
    parcelas: item.doc.parcelas,
    parcelasPagas: parcelasPagasPelaData(item, contexto.datas, agora),
    taxaJurosMensal: item.doc.taxaJurosMensal,
  }));

  const resposta = await javaServerClient.enviarPedido<PedidoCalcularParcelamentos, RespostaCalcularParcelamentos>(
    "PedidoCalcularParcelamentos",
    "RespostaCalcularParcelamentos",
    { parcelamentos }
  );

  return {
    parcelamentos: resposta.parcelamentos.map((p, i): InstallmentResponseDto => {
      const transacaoId = contexto.transacoes.get(p.id);
      return {
        id: p.id,
        cartaoId: itens[i].doc.cartaoId ?? contexto.padraoId,
        ...(transacaoId ? { transacaoId } : {}),
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
      };
    }),
    totalParcelasDoMes: resposta.totalParcelasDoMes,
    totalSaldoDevedor: resposta.totalSaldoDevedor,
    totalJuros: resposta.totalJuros,
  };
}

// ---------------------------------------------------------------------------------------------------- cartões

const cartaoNaoEncontrado = () => new AppError("Cartão não encontrado", 404, "CARD_NOT_FOUND");
const parcelamentoNaoEncontrado = () => new AppError("Parcelamento não encontrado", 404, "INSTALLMENT_NOT_FOUND");
const nomeEmUso = () => new AppError("Você já tem um cartão com esse nome", 409, "CARD_NAME_TAKEN");

// Os cartões do usuário, do mais antigo (o padrão, primeiro da lista) para o mais novo. Quem não tem nenhum recebe o padrão.
async function carregarCartoes(userId: string): Promise<Item<CardDocument>[]> {
  await investmentsRepository.ensureDefaultCard(userId);
  return (await investmentsRepository.findCards(userId)).map((c) => comoItem<CardDocument>(c));
}

// A fatura e o limite de cada cartão (ou só do `apenasId`) são calculados só com as compras e os parcelamentos dele.
// Compras no crédito sem cartão indicado, e parcelamentos antigos, contam para o cartão mais antigo.
async function montarCartoes(userId: string, apenasId?: string): Promise<CardResponseDto[]> {
  const cartoes = await carregarCartoes(userId);
  const alvo = apenasId ? cartoes.filter((c) => c.id === apenasId) : cartoes;
  if (apenasId && alvo.length === 0) throw cartaoNaoEncontrado();

  const padraoId = cartoes[0].id;
  const agora = new Date();
  const [compras, parcelamentos] = await Promise.all([
    investmentsRepository.somarComprasNoCredito(userId, inicioDoMes(agora), agora),
    investmentsRepository.findInstallments(userId),
  ]);
  const itens = parcelamentos.map((p) => comoItem<InstallmentDocument>(p));
  const semContexto: ContextoParcelamentos = {
    padraoId,
    transacoes: new Map(),
    datas: await investmentsRepository.datasDasCompras(userId, itens.map((p) => p.id)),
  };

  return Promise.all(
    alvo.map(async ({ id, doc }): Promise<CardResponseDto> => {
      const ehPadrao = id === padraoId;
      const doCartao = itens.filter((p) => (p.doc.cartaoId ?? padraoId) === id);
      const parc = await calcularParcelamentos(doCartao, semContexto);
      const comprasNoCredito = emReais(
        compras.filter((c) => c.cartaoId === id || (c.cartaoId === null && ehPadrao)).reduce((soma, c) => soma + c.total, 0)
      );
      const fechamento = proximoFechamento(doc.diaFechamento, agora);
      const vencimento = vencimentoDoFechamento(fechamento);

      return {
        id,
        nome: doc.nome,
        padrao: ehPadrao,
        limite: doc.limite,
        diaFechamento: doc.diaFechamento,
        limiteDisponivel: emReais(doc.limite - comprasNoCredito - parc.totalSaldoDevedor),
        saldoDevedor: parc.totalSaldoDevedor,
        parcelamentosAtivos: parc.parcelamentos.filter((p) => !p.quitado).length,
        fatura: {
          mes: inicioDoMes(agora).toISOString().slice(0, 7),
          valor: emReais(comprasNoCredito + parc.totalParcelasDoMes),
          comprasNoCredito,
          parcelasDoMes: parc.totalParcelasDoMes,
          fechamento: fechamento.toISOString().slice(0, 10),
          diasParaFechar: Math.round((fechamento.getTime() - inicioDoDia(agora).getTime()) / UM_DIA_MS),
          vencimento: vencimento.toISOString().slice(0, 10),
          diasParaVencer: Math.round((vencimento.getTime() - inicioDoDia(agora).getTime()) / UM_DIA_MS),
        },
      };
    })
  );
}

const ehViolacaoDeUnico = (erro: unknown) => (erro as { code?: number } | null)?.code === 11000;

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

  // ------------------------------------------------------------------------------------------ cartões
  async listCards(userId: string): Promise<CardsResponseDto> {
    const cartoes = await montarCartoes(userId);
    return {
      cartoes,
      maximo: MAX_CARTOES,
      totais: {
        limite: emReais(cartoes.reduce((s, c) => s + c.limite, 0)),
        limiteDisponivel: emReais(cartoes.reduce((s, c) => s + c.limiteDisponivel, 0)),
        saldoDevedor: emReais(cartoes.reduce((s, c) => s + c.saldoDevedor, 0)),
        faturaDoMes: emReais(cartoes.reduce((s, c) => s + c.fatura.valor, 0)),
      },
    };
  },

  async getCardById(userId: string, id: string): Promise<CardResponseDto> {
    return (await montarCartoes(userId, id))[0];
  },

  // Até MAX_CARTOES por usuário e nome único (sem diferenciar maiúsculas). O nome é conferido antes e o índice único
  // do banco pega a corrida entre duas criações juntas.
  async createCard(userId: string, dados: CreateCardDto): Promise<CardResponseDto> {
    if ((await investmentsRepository.countCards(userId)) >= MAX_CARTOES) {
      throw new AppError(`Você já tem o máximo de ${MAX_CARTOES} cartões`, 409, "CARD_LIMIT_REACHED");
    }
    if (await investmentsRepository.findCardByName(userId, dados.nome)) throw nomeEmUso();

    let criado;
    try {
      criado = await investmentsRepository.createCard({ userId, ...dados });
    } catch (erro) {
      throw ehViolacaoDeUnico(erro) ? nomeEmUso() : erro;
    }
    const id = comId<CardDocument>(criado)._id.toString();

    // duas criações juntas podem passar da conferência acima: a que ficou além do máximo é desfeita
    if ((await investmentsRepository.countCards(userId)) > MAX_CARTOES) {
      await investmentsRepository.removeCard(userId, id, false);
      throw new AppError(`Você já tem o máximo de ${MAX_CARTOES} cartões`, 409, "CARD_LIMIT_REACHED");
    }
    return (await montarCartoes(userId, id))[0];
  },

  async updateCardById(userId: string, id: string, alteracoes: UpdateCardDto): Promise<CardResponseDto> {
    if (!(await investmentsRepository.findCard(userId, id))) throw cartaoNaoEncontrado();
    if (alteracoes.nome !== undefined && (await investmentsRepository.findCardByName(userId, alteracoes.nome, id))) {
      throw nomeEmUso();
    }
    try {
      if (!(await investmentsRepository.updateCard(userId, id, alteracoes))) throw cartaoNaoEncontrado();
    } catch (erro) {
      throw ehViolacaoDeUnico(erro) ? nomeEmUso() : erro;
    }
    return (await montarCartoes(userId, id))[0];
  },

  // Com parcelamento ainda ativo: 409 CARD_HAS_INSTALLMENTS e nada muda. Sem ele, o cartão e os parcelamentos quitados
  // saem e as transações dele são desvinculadas (ver o repository).
  async removeCardById(userId: string, id: string): Promise<void> {
    const cartoes = await carregarCartoes(userId);
    if (!cartoes.some((c) => c.id === id)) throw cartaoNaoEncontrado();

    const ehPadrao = cartoes[0].id === id;
    const agora = new Date();
    const itens = (await investmentsRepository.findInstallments(userId)).map((p) => comoItem<InstallmentDocument>(p));
    const doCartao = itens.filter((p) => (p.doc.cartaoId ?? cartoes[0].id) === id);
    const datas = await investmentsRepository.datasDasCompras(userId, doCartao.map((p) => p.id));
    if (doCartao.some((p) => parcelasPagasPelaData(p, datas, agora) < p.doc.parcelas)) {
      throw new AppError(
        "Este cartão tem parcelamentos em andamento: quite ou exclua os parcelamentos antes de excluir o cartão",
        409,
        "CARD_HAS_INSTALLMENTS"
      );
    }
    if (!(await investmentsRepository.removeCard(userId, id, ehPadrao))) throw cartaoNaoEncontrado();
  },

  // Rotas antigas (/card): o "cartão padrão" é o mais antigo do usuário.
  async getCard(userId: string): Promise<CardResponseDto> {
    return (await montarCartoes(userId))[0];
  },

  async updateCard(userId: string, alteracoes: UpdateCardDto): Promise<CardResponseDto> {
    const [padrao] = await carregarCartoes(userId);
    return investmentsService.updateCardById(userId, padrao.id, alteracoes);
  },

  // ------------------------------------------------------------------------------------------ parcelamentos
  // Todos os do usuário, ou só os de um cartão (`cartaoId`).
  async listInstallments(userId: string, cartaoId?: string): Promise<InstallmentsResponseDto> {
    let itens = (await investmentsRepository.findInstallments(userId)).map((p) => comoItem<InstallmentDocument>(p));
    const contexto = await contextoDeParcelamentos(userId, itens.map((p) => p.id));
    if (cartaoId) {
      if (!(await investmentsRepository.findCard(userId, cartaoId))) throw cartaoNaoEncontrado();
      itens = itens.filter((p) => (p.doc.cartaoId ?? contexto.padraoId) === cartaoId);
    }
    return calcularParcelamentos(itens, contexto);
  },

  // Como no portfólio, a conta (e a validação do Servidor) vem antes de gravar. Sem cartaoId, vai para o cartão mais antigo.
  async createInstallment(userId: string, dados: CreateInstallmentDto): Promise<InstallmentResponseDto> {
    const { cartaoId: cartaoPedido, ...contrato } = dados;
    let cartaoId: string;
    if (cartaoPedido) {
      if (!(await investmentsRepository.findCard(userId, cartaoPedido))) throw cartaoNaoEncontrado();
      cartaoId = cartaoPedido;
    } else {
      cartaoId = comId<CardDocument>(await investmentsRepository.findOldestCard(userId))._id.toString();
    }

    const novo: InstallmentDocument = { userId, cartaoId, ...contrato };
    const { parcelamentos } = await calcularParcelamentos([{ id: "novo", doc: novo }], { padraoId: cartaoId, transacoes: new Map(), datas: new Map() });

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
    const contexto = await contextoDeParcelamentos(userId, [id]);
    const { parcelamentos } = await calcularParcelamentos(
      [{ id, doc: { ...atual, ...alteracoes, parcelasPagas } as InstallmentDocument }],
      contexto
    );

    if (!(await investmentsRepository.updateInstallment(userId, id, alteracoes))) throw parcelamentoNaoEncontrado();
    return parcelamentos[0];
  },

  // Um parcelamento que nasceu de uma compra no crédito só sai junto com a transação: 409 INSTALLMENT_FROM_TRANSACTION.
  async removeInstallment(userId: string, id: string): Promise<void> {
    if (!(await investmentsRepository.findInstallment(userId, id))) throw parcelamentoNaoEncontrado();
    if ((await investmentsRepository.transacoesDosParcelamentos(userId, [id])).size > 0) {
      throw new AppError(
        "Este parcelamento vem de uma compra no crédito: exclua a transação para removê-lo",
        409,
        "INSTALLMENT_FROM_TRANSACTION"
      );
    }
    if (!(await investmentsRepository.removeInstallment(userId, id))) throw parcelamentoNaoEncontrado();
  },
};
