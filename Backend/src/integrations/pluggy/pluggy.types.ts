// src/integrations/pluggy/pluggy.types.ts
// Só os campos da Pluggy que o FinanceAI usa (a API devolve muitos outros). O formato é o das respostas reais
// do sandbox; um exemplo completo está em Backend/test/fixtures/pluggy-sandbox.json.

export interface PluggyItem {
  id: string;
  status: string; // UPDATING, UPDATED, LOGIN_ERROR, OUTDATED, WAITING_USER_INPUT...
  executionStatus?: string | null;
  clientUserId?: string | null; // o usuário do FinanceAI que criou a conexão (usado para provar de quem é o item)
  connector?: { id: number; name: string } | null;
}

export interface PluggyAccount {
  id: string;
  type: string; // BANK ou CREDIT
  subtype?: string | null;
  name: string;
  balance?: number | null;
  currencyCode?: string | null;
}

export interface PluggyTransaction {
  id: string;
  description?: string | null;
  amount: number; // negativo = despesa, positivo = receita (vale para conta e para cartão)
  date: string; // ISO 8601
  type?: string | null; // DEBIT/CREDIT: NÃO use para receita/despesa (no cartão as compras vêm como CREDIT)
  status?: string | null; // POSTED ou PENDING
  operationType?: string | null;
  paymentData?: { paymentMethod?: string | null } | null;
}
