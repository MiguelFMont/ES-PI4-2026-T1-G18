// src/modules/investments/investments.dto.ts
import { z } from "zod";
import { TIPOS_DE_ATIVO, TipoDeAtivo } from "./investments.model";

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

export const updateCardSchema = z
  .object({
    limite: z.number().positive().optional(),
    diaVencimento: z.number().int().min(1).max(28).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo para alterar" });

export const createInstallmentSchema = z
  .object({
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
  limite: number;
  diaVencimento: number;
  // limite - compras no crédito do mês - saldo devedor dos parcelamentos (pode ficar negativo se o limite estourar)
  limiteDisponivel: number;
  fatura: {
    mes: string; // AAAA-MM
    valor: number; // compras no crédito do mês + parcelas do mês
    comprasNoCredito: number; // despesas reais pagas com cartão de crédito neste mês
    parcelasDoMes: number;
    vencimento: string; // AAAA-MM-DD
    diasParaVencer: number;
  };
}
