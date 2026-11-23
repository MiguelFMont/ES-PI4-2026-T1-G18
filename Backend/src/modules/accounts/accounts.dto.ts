/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/accounts/accounts.dto.ts
import { z } from "zod";
import { aparenciaNaCriacao, aparenciaNaEdicao } from "../../shared/aparencia/aparencia";
import { CODIGOS_BANCOS, TIPOS_CONTA, TipoConta } from "./accounts.model";

const idSchema = z.string().regex(/^[a-f\d]{24}$/i, "Id inválido");
const saldo = z.number().finite().min(-1e12).max(1e12);
const nome = z.string().trim().min(1).max(40);

export const accountIdSchema = idSchema;

export const createAccountSchema = z
  .object({
    nome,
    banco: z.enum(CODIGOS_BANCOS),
    tipo: z.enum(TIPOS_CONTA).default("manual"),
    saldoInicial: saldo.default(0),
    // só em contas open_finance: a conexão (de /connected-accounts) de onde vem o saldo
    conectadaId: idSchema.optional(),
    ...aparenciaNaCriacao, // ícone e cor da conta (opcionais)
  })
  .superRefine((d, ctx) => {
    if (d.tipo === "open_finance" && !d.conectadaId) {
      ctx.addIssue({ code: "custom", path: ["conectadaId"], message: "Informe a conexão da conta Open Finance" });
    }
    if (d.tipo === "manual" && d.conectadaId) {
      ctx.addIssue({ code: "custom", path: ["conectadaId"], message: "Só contas Open Finance têm conexão" });
    }
  });

// Editar uma conta muda só o nome e o banco: o saldo inicial se define ao criar (depois, o saldo muda com os lançamentos e as transferências)
export const updateAccountSchema = z
  .object({ nome, banco: z.enum(CODIGOS_BANCOS), ...aparenciaNaEdicao })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo para alterar" });

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;

// O que o Frontend recebe: `id` no lugar de `_id`, sem `userId` nem `nomeChave`.
export interface AccountResponseDto {
  id: string;
  nome: string;
  banco: string; // código (ver GET /accounts/banks)
  bancoNome: string;
  tipo: TipoConta;
  saldoInicial: number;
  saldoAtual: number; // calculado (manual) ou lido do provedor (open_finance)
  conectadaId?: string;
  icone?: string; // chave do ícone escolhido (ver src/shared/aparencia); sem ela, vale o logo do banco
  cor?: string; // matiz escolhido
  criadaEm: string; // ISO 8601
}

// A conta dentro de uma transação (GET /transactions).
export interface AccountResumoDto {
  id: string;
  nome: string;
  banco: string;
  bancoNome: string;
  icone?: string;
  cor?: string;
}

// Mensagens trocadas com o Servidor Java (Servidor/src/main/java/com/financeai/transactions/): os nomes dos campos
// são exatamente os do JSON de PedidoCalcularSaldoContas e de RespostaCalcularSaldoContas.
export interface PedidoCalcularSaldoContas {
  contas: { id: string; saldoInicial: number }[];
  movimentos: { tipo: "receita" | "despesa" | "transferencia"; valor: number; contaId: string; contaDestinoId?: string }[];
}
export interface RespostaCalcularSaldoContas {
  saldos: { contaId: string; saldoAtual: number }[];
}
