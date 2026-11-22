// src/modules/investments/investments.dto.ts
import { z } from "zod";
import { CARTAO_PADRAO, TIPOS_DE_ATIVO, TipoDeAtivo } from "./investments.model";

export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Id inválido");

export const createInvestmentSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  tipo: z.enum(TIPOS_DE_ATIVO).default("outro"),
  valorInvestido: z.number().positive(),
  // % ao mês; abaixo de -100 o valor ficaria negativo
  taxaMensal: z.number().gt(-100).lte(100).default(0),
  // sem dataAplicacao, vale hoje
  dataAplicacao: z.coerce.date().optional(),
});

const nomeDoCartao = z.string().trim().min(1).max(40);

// Cartão novo: só o nome é obrigatório; limite e dia do fechamento assumem os valores padrão.
export const createCardSchema = z.object({
  nome: nomeDoCartao,
  limite: z.number().positive().default(CARTAO_PADRAO.limite),
  diaFechamento: z.number().int().min(1).max(28).default(CARTAO_PADRAO.diaFechamento),
});

export const updateCardSchema = z
  .object({
    nome: nomeDoCartao.optional(),
    limite: z.number().positive().optional(),
    diaFechamento: z.number().int().min(1).max(28).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo para alterar" });

// Filtro opcional da listagem de parcelamentos: só os de um cartão.
export const listInstallmentsQuerySchema = z.object({ cartaoId: idSchema.optional() });

export const createInstallmentSchema = z
  .object({
    // sem cartaoId, o parcelamento vai para o cartão mais antigo do usuário
    cartaoId: idSchema.optional(),
    descricao: z.string().trim().min(1).max(100),
    valorTotal: z.number().positive(),
    parcelas: z.number().int().min(1).max(120),
    parcelasPagas: z.number().int().min(0).default(0),
    taxaJurosMensal: z.number().min(0).lte(100).default(0),
  })
  .refine((p) => p.parcelasPagas <= p.parcelas, { message: "Parcelas pagas não pode passar do total de parcelas", path: ["parcelasPagas"] });

// Edição de um parcelamento: a descrição e quantas parcelas já foram pagas (o resto é o contrato do parcelamento).
export const updateInstallmentSchema = z
  .object({
    descricao: z.string().trim().min(1).max(100).optional(),
    parcelasPagas: z.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo para alterar" });

export type CreateInvestmentDto = z.infer<typeof createInvestmentSchema>;
export type CreateCardDto = z.infer<typeof createCardSchema>;
export type UpdateCardDto = z.infer<typeof updateCardSchema>;
export type CreateInstallmentDto = z.infer<typeof createInstallmentSchema>;
export type UpdateInstallmentDto = z.infer<typeof updateInstallmentSchema>;

// Mensagens trocadas com o Servidor Java (Servidor/src/main/java/com/financeai/investments/): os nomes dos campos são
// exatamente os do JSON de cada pedido e resposta.
export interface AtivoParaCalculo {
  id: string;
  nome: string;
  tipo: TipoDeAtivo;
  valor: number;
  taxaMensal: number;
  meses: number;
}
export interface PedidoRentabilidadeSimulada {
  ativos: AtivoParaCalculo[];
}
export interface AtivoCalculado extends AtivoParaCalculo {
  valorAtual: number;
  rendimento: number;
  rentabilidade: number;
  percentualCarteira: number;
}
export interface RespostaRentabilidadeSimulada {
  ativos: AtivoCalculado[];
  totalInvestido: number;
  patrimonio: number;
  rendimento: number;
  rentabilidade: number;
}

export interface ParcelamentoParaCalculo {
  id: string;
  descricao: string;
  valorTotal: number;
  parcelas: number;
  parcelasPagas: number;
  taxaJurosMensal: number;
}
export interface PedidoCalcularParcelamentos {
  parcelamentos: ParcelamentoParaCalculo[];
}
export interface ParcelamentoCalculado extends ParcelamentoParaCalculo {
  valorParcela: number;
  parcelasRestantes: number;
  saldoDevedor: number;
  jurosTotal: number;
  quitado: boolean;
}
export interface RespostaCalcularParcelamentos {
  parcelamentos: ParcelamentoCalculado[];
  totalParcelasDoMes: number;
  totalSaldoDevedor: number;
  totalJuros: number;
}

// O que o Frontend recebe.
export interface InvestmentResponseDto {
  id: string;
  nome: string;
  tipo: TipoDeAtivo;
  valorInvestido: number;
  taxaMensal: number; // a rentabilidade do último mês, em %
  dataAplicacao: string; // ISO 8601
  mesesRendendo: number;
  valorAtual: number;
  rendimento: number;
  rentabilidade: number; // % sobre o valor investido, desde a aplicação
  percentualCarteira: number;
}
export interface PortfolioResponseDto {
  ativos: InvestmentResponseDto[];
  totalInvestido: number;
  patrimonio: number;
  rendimento: number;
  rentabilidade: number;
}

export interface InstallmentResponseDto {
  id: string;
  cartaoId: string;
  // a transação (compra no crédito) que gerou o parcelamento; só aparece quando ele veio de uma compra. Um parcelamento
  // assim some junto com a transação e não pode ser excluído por aqui.
  transacaoId?: string;
  descricao: string;
  valorTotal: number;
  parcelas: number;
  parcelasPagas: number;
  parcelasRestantes: number;
  taxaJurosMensal: number;
  valorParcela: number;
  saldoDevedor: number;
  jurosTotal: number;
  quitado: boolean;
}
export interface InstallmentsResponseDto {
  parcelamentos: InstallmentResponseDto[];
  totalParcelasDoMes: number;
  totalSaldoDevedor: number;
  totalJuros: number;
}

export interface CardResponseDto {
  id: string;
  nome: string;
  // true no cartão mais antigo: o que recebe as compras no crédito sem cartão indicado (e as rotas /card antigas)
  padrao: boolean;
  limite: number;
  diaFechamento: number;
  // limite - compras no crédito do mês - saldo devedor dos parcelamentos (pode ficar negativo se o limite estourar)
  limiteDisponivel: number;
  saldoDevedor: number; // dos parcelamentos ainda ativos deste cartão
  parcelamentosAtivos: number;
  fatura: {
    mes: string; // AAAA-MM
    valor: number; // compras no crédito do mês + parcelas do mês
    comprasNoCredito: number; // despesas reais à vista no crédito neste mês (as parceladas entram pelas parcelas)
    parcelasDoMes: number;
    fechamento: string; // AAAA-MM-DD: o próximo fechamento desta fatura
    diasParaFechar: number;
    vencimento: string; // AAAA-MM-DD: 7 dias depois do fechamento
    diasParaVencer: number;
  };
}

export interface CardsResponseDto {
  cartoes: CardResponseDto[]; // do mais antigo para o mais novo
  maximo: number; // quantos cartões o usuário pode ter
  totais: {
    limite: number;
    limiteDisponivel: number;
    saldoDevedor: number;
    faturaDoMes: number;
  };
}
