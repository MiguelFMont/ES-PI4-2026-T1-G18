// src/modules/transactions/__tests__/apoio.ts
// Montagem comum dos testes de rota de transações: o app Express numa porta livre, um banco isolado e as chamadas HTTP.
// Usa o ambiente de transações (./ambiente: variáveis falsas e Servidor Java inalcançável) e o banco de teste de contas
// conectadas (TESTE_MONGO_URI opcional), então nada toca o Atlas, o Servidor Java nem a Pluggy. Todo arquivo de teste de
// rota importa este ANTES de tudo.
import "./ambiente";
import { after, afterEach, before, beforeEach, mock } from "node:test";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../../http/app";
import { env } from "../../../config/env";
import { TransactionDocument, TransactionModel } from "../transactions.model";
import { encerrarBanco, iniciarBanco, limparBanco } from "../../connected-accounts/__tests__/banco";

export const tokenDe = (id: string) => jwt.sign({ id, email: `${id}@teste.com` }, env.JWT_SECRET, { expiresIn: "1h" });

// Dois usuários, para provar que um nunca enxerga nem altera as transações do outro.
export const ANA = tokenDe("ana");
export const BETO = tokenDe("beto");

/** Uma transação manual válida, no formato que a API recebe. */
export const TRANSACAO_VALIDA = {
  tipo: "despesa",
  valor: 42.9,
  categoria: "Alimentacao",
  data: "2026-10-05T12:00:00.000Z",
  descricao: "Supermercado",
  formaPagamento: "debito",
} as const;

/** Um id com formato válido (24 caracteres hexadecimais) que não existe no banco. */
export const ID_INEXISTENTE = "a".repeat(24);

export const json = (resposta: Response): Promise<any> => resposta.json();

/**
 * Liga o servidor e o banco antes dos testes do arquivo, limpa o banco entre um teste e outro e desfaz os dublês no fim
 * de cada teste. Chame no topo do arquivo: `const { chamar } = prepararApi();`.
 */
export function prepararApi() {
  let servidor: Server;
  let base = "";

  before(async () => {
    await iniciarBanco();
    servidor = app.listen(0);
    await once(servidor, "listening");
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise((resolver) => servidor.close(resolver));
    await encerrarBanco();
  });

  beforeEach(limparBanco);
  afterEach(() => mock.restoreAll());

  return {
    /** Chama a API (`caminho` sem o /v1). Sem `token`, a chamada vai sem login. */
    chamar(metodo: string, caminho: string, token?: string, corpo?: unknown) {
      return fetch(`${base}/v1${caminho}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    },

    /** Como `chamar`, mas o corpo vai como texto cru (para mandar um JSON quebrado de propósito). */
    chamarComTexto(metodo: string, caminho: string, token: string, texto: string) {
      return fetch(`${base}/v1${caminho}`, {
        method: metodo,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: texto,
      });
    },
  };
}

/** Grava direto no banco, sem passar pela API (para montar cenários: importadas, datas antigas, muitas transações). */
export async function inserir(userId: string, dados: Partial<TransactionDocument> = {}) {
  const criada = await TransactionModel.create({
    ...TRANSACAO_VALIDA,
    data: new Date(TRANSACAO_VALIDA.data),
    userId,
    ...dados,
  });
  return criada._id.toString();
}

/** Texto com exatamente `n` caracteres (para os limites de tamanho). */
export const textoDe = (n: number) => "x".repeat(n);
