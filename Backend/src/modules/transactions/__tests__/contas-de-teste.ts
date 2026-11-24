/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/transactions/__tests__/contas-de-teste.ts
// Todo lançamento manual leva uma conta (contaId obrigatório, RN5). Os testes de rota que não tratam de contas ganham aqui uma
// conta manual por usuário de teste e o `contaId` é preenchido sozinho na chamada POST /transactions (sem contaId no corpo).
// Os testes que tratam de contas usam `chamarCru` (sem preencher nada) e criam as contas que quiserem.
import jwt from "jsonwebtoken";
import { AccountModel } from "../../accounts/accounts.model";
import { CardModel } from "../../investments/investments.model";

/** O id da conta "Conta corrente" de cada usuário de teste (preenchido por criarContasDeTeste, a cada teste). */
export const CONTAS: Record<string, string> = {};

export async function criarContasDeTeste(usuarios: string[] = ["ana", "beto"]) {
  for (const userId of usuarios) {
    const conta = await AccountModel.create({
      userId,
      nome: "Conta corrente",
      nomeChave: "conta corrente",
      banco: "nubank",
      tipo: "manual",
      saldoInicial: 0,
    });
    CONTAS[userId] = conta._id.toString();
  }
}

/** Preenche o contaId (a conta do dono do token) em POST /transactions quando o corpo não traz a chave `contaId`. */
export function comContaDoToken(metodo: string, caminho: string, token: string | undefined, corpo: unknown): unknown {
  // POST /transactions e POST /investments/cards (o cartão também é vinculado a uma conta, obrigatória)
  if (metodo !== "POST" || !["/transactions", "/investments/cards"].includes(caminho) || !token) return corpo;
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo) || "contaId" in corpo) return corpo;
  const dono = (jwt.decode(token) as { id?: string } | null)?.id;
  const contaId = dono ? CONTAS[dono] : undefined;
  return contaId ? { ...corpo, contaId } : corpo;
}

/**
 * O cartão "padrão" dos testes antigos: antes o Backend criava um cartão "Cartão" sozinho. Agora ter cartão é opcional, então os testes
 * que dependem de um cartão já existente o criam aqui (limite 5000, fecha dia 3, vinculado à conta de teste de cada usuário).
 */
export async function criarCartoesPadrao(usuarios: string[] = ["ana", "beto"]) {
  for (const userId of usuarios) {
    await CardModel.create({ userId, nome: "Cartão", nomeChave: "cartão", limite: 5000, diaFechamento: 3, contaId: CONTAS[userId] });
  }
}
