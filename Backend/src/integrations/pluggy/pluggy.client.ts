// src/integrations/pluggy/pluggy.client.ts
// Cliente da API da Pluggy (Open Finance, sandbox). Só o Backend chama a Pluggy: as credenciais
// (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET) nunca vão para o Frontend nem para o Git.
//
// - A apiKey vale 2 horas: fica em memória e é renovada antes de vencer (ou se a Pluggy responder 401).
// - Falha de rede ou tempo esgotado vira 503 PLUGGY_UNAVAILABLE; recusa da Pluggy vira 422 ou 502 (ver erroDaPluggy).
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { PluggyAccount, PluggyItem, PluggyTransaction } from "./pluggy.types";

const VALIDADE_DA_CHAVE_MS = 110 * 60 * 1000; // a Pluggy emite chaves de 2 horas; renovamos antes
const LIMITE_DE_PAGINAS = 50; // trava de segurança na paginação por cursor (500 por página)
const ITEM_EM_ANDAMENTO = ["CREATED", "UPDATING", "LOGIN_IN_PROGRESS"];

/** Conector de teste "Pluggy Bank" do sandbox e as suas credenciais públicas. */
export const CONECTOR_SANDBOX = 2;
export const CREDENCIAIS_SANDBOX = { user: "user-ok", password: "password-ok" };

let cache: { chave: string; expiraEm: number } | null = null;
let autenticando: Promise<string> | null = null;

const naoConfigurada = () =>
  new AppError("Integração com a Pluggy não configurada", 503, "PLUGGY_NOT_CONFIGURED");
const indisponivel = () => new AppError("Pluggy indisponível", 503, "PLUGGY_UNAVAILABLE");

async function requisitar(caminho: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${env.PLUGGY_BASE_URL}${caminho}`, {
      ...init,
      signal: AbortSignal.timeout(env.PLUGGY_TIMEOUT_MS),
    });
  } catch {
    throw indisponivel();
  }
}

async function corpoJson(resposta: Response): Promise<any> {
  try {
    return await resposta.json();
  } catch {
    return null;
  }
}

// Traduz uma resposta de erro da Pluggy: 404 -> 404, outros 4xx (credenciais da instituição inválidas...) -> 422, 5xx -> 502.
async function erroDaPluggy(resposta: Response): Promise<AppError> {
  const corpo = await corpoJson(resposta);
  const mensagem: string | undefined = corpo?.message;
  if (resposta.status === 404) return new AppError(mensagem ?? "Recurso não encontrado na Pluggy", 404, "PLUGGY_NOT_FOUND");
  if (resposta.status < 500) return new AppError(mensagem ?? "Pedido recusado pela Pluggy", 422, "PLUGGY_REJECTED");
  return new AppError("Erro na Pluggy", 502, "PLUGGY_ERROR");
}

async function obterChave(): Promise<string> {
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) throw naoConfigurada();
  if (cache && cache.expiraEm > Date.now()) return cache.chave;
  if (autenticando) return autenticando;

  autenticando = (async () => {
    const resposta = await requisitar("/auth", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }),
    });
    const corpo = await corpoJson(resposta);
    if (!resposta.ok || !corpo?.apiKey) {
      throw new AppError("Credenciais da Pluggy recusadas", 502, "PLUGGY_AUTH_FAILED");
    }
    cache = { chave: corpo.apiKey, expiraEm: Date.now() + VALIDADE_DA_CHAVE_MS };
    return corpo.apiKey as string;
  })().finally(() => {
    autenticando = null;
  });
  return autenticando;
}

async function chamar<T>(caminho: string, init: RequestInit = {}, tentativa = 1): Promise<T> {
  const chave = await obterChave();
  const resposta = await requisitar(caminho, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", ...init.headers, "X-API-KEY": chave },
  });

  if (resposta.status === 401 && tentativa === 1) {
    cache = null; // a chave pode ter sido invalidada: autentica de novo uma vez
    return chamar<T>(caminho, init, 2);
  }
  if (!resposta.ok) throw await erroDaPluggy(resposta);
  return (await corpoJson(resposta)) as T;
}

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const pluggyClient = {
  /** Token curto para abrir o widget Pluggy Connect no Frontend. O `clientUserId` fica gravado no item criado. */
  async criarConnectToken(clientUserId: string): Promise<{ accessToken: string }> {
    return chamar("/connect_token", { method: "POST", body: JSON.stringify({ options: { clientUserId } }) });
  },

  async criarItem(connectorId: number, parameters: Record<string, string>, clientUserId: string): Promise<PluggyItem> {
    return chamar("/items", { method: "POST", body: JSON.stringify({ connectorId, parameters, clientUserId }) });
  },

  async obterItem(id: string): Promise<PluggyItem> {
    return chamar(`/items/${encodeURIComponent(id)}`);
  },

  /** Espera o item terminar de sincronizar (alguns segundos). Se o tempo acabar, devolve o item ainda "em andamento". */
  async esperarItem(id: string): Promise<PluggyItem> {
    const limite = Date.now() + env.PLUGGY_ESPERA_ITEM_MS;
    let item = await this.obterItem(id);
    while (ITEM_EM_ANDAMENTO.includes(item.status) && Date.now() < limite) {
      await dormir(env.PLUGGY_INTERVALO_MS);
      item = await this.obterItem(id);
    }
    return item;
  },

  async listarContas(itemId: string): Promise<PluggyAccount[]> {
    const resposta = await chamar<{ results?: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
    return resposta.results ?? [];
  },

  /** Todas as transações de uma conta. O `GET /transactions` antigo foi descontinuado: o v2 pagina por cursor (`next`). */
  async listarTransacoes(accountId: string): Promise<PluggyTransaction[]> {
    const todas: PluggyTransaction[] = [];
    let caminho: string | null = `/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
    for (let pagina = 0; caminho && pagina < LIMITE_DE_PAGINAS; pagina++) {
      const resposta: { results?: PluggyTransaction[]; next?: string | null } = await chamar(caminho);
      todas.push(...(resposta.results ?? []));
      caminho = resposta.next ? `/v2/transactions${resposta.next}` : null;
    }
    return todas;
  },

  async apagarItem(id: string): Promise<void> {
    await chamar(`/items/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /** Só para testes: esquece a apiKey em memória. */
  _limparCache() {
    cache = null;
    autenticando = null;
  },
};
