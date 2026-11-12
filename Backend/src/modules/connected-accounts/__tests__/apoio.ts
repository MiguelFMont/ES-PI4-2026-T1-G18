// src/modules/connected-accounts/__tests__/apoio.ts
// Dublês dos testes de contas conectadas: uma "Pluggy" simulada (que serve os dados reais da fixture do sandbox) e o
// Servidor Java de categorização. Usam o `mock` global do node:test; cada arquivo chama mock.restoreAll() no afterEach.
import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { env } from "../../../config/env";
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";
import { PluggyItem, PluggyTransaction } from "../../../integrations/pluggy/pluggy.types";

export interface FixtureConta {
  id: string;
  type: string;
  name: string;
  balance: number;
  currencyCode: string;
  transacoes: PluggyTransaction[];
}

// A fixture: contas e transações reais do sandbox da Pluggy (Backend/test/fixtures/pluggy-sandbox.json).
export function carregarFixture(): { contas: FixtureConta[] } {
  const arquivo = path.resolve(__dirname, "../../../../test/fixtures/pluggy-sandbox.json");
  return JSON.parse(readFileSync(arquivo, "utf8"));
}

interface ItemSimulado {
  item: PluggyItem;
  consultas: number; // quantas vezes o item foi lido (a sincronização "termina" depois de algumas)
  segurado: boolean; // continua UPDATING até alguém liberar
  statusFinal: string;
}

const fetchOriginal = globalThis.fetch;
const TAMANHO_DA_PAGINA = 20;

export function simularPluggy() {
  const fixture = carregarFixture();
  const itens = new Map<string, ItemSimulado>();
  const chamadas: { metodo: string; caminho: string }[] = [];
  const falhas: { padrao: RegExp; status: number }[] = [];
  let autenticacoes = 0;
  let chaveValida = "";
  let rede = true;

  const json = (corpo: unknown, status = 200) => Response.json(corpo, { status });

  mock.method(globalThis, "fetch", async (entrada: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.origin !== env.PLUGGY_BASE_URL) return fetchOriginal(entrada, init);
    if (!rede) throw new TypeError("fetch failed");

    const metodo = (init.method ?? "GET").toUpperCase();
    const caminho = url.pathname + url.search;
    chamadas.push({ metodo, caminho });

    const falha = falhas.find((f) => f.padrao.test(`${metodo} ${caminho}`));
    if (falha) return json({ message: "falha simulada" }, falha.status);

    if (url.pathname === "/auth" && metodo === "POST") {
      autenticacoes++;
      chaveValida = `chave-${autenticacoes}`;
      return json({ apiKey: chaveValida });
    }

    const chave = new Headers(init.headers).get("X-API-KEY");
    if (chave !== chaveValida) return json({ message: "API key inválida" }, 401);

    if (url.pathname === "/connect_token" && metodo === "POST") return json({ accessToken: "token-simulado" });

    if (url.pathname === "/items" && metodo === "POST") {
      const corpo = JSON.parse(String(init.body));
      const item: PluggyItem = {
        id: randomUUID(),
        status: "UPDATING",
        clientUserId: corpo.clientUserId ?? null,
        connector: { id: corpo.connectorId, name: "Pluggy Bank" },
      };
      itens.set(item.id, { item, consultas: 0, segurado: false, statusFinal: "UPDATED" });
      return json(item);
    }

    const itemDaRota = url.pathname.match(/^\/items\/([^/]+)$/);
    if (itemDaRota) {
      const dados = itens.get(itemDaRota[1]);
      if (!dados) return json({ message: "Item não encontrado" }, 404);
      if (metodo === "DELETE") {
        itens.delete(itemDaRota[1]);
        return json({ ok: true });
      }
      dados.consultas++;
      const pronto = !dados.segurado && dados.consultas > 1; // a primeira leitura ainda mostra UPDATING
      return json({ ...dados.item, status: pronto ? dados.statusFinal : "UPDATING" });
    }

    if (url.pathname === "/accounts") {
      return json({ results: fixture.contas.map(({ transacoes: _t, ...conta }) => conta) });
    }

    if (url.pathname === "/v2/transactions") {
      const conta = fixture.contas.find((c) => c.id === url.searchParams.get("accountId"));
      if (!conta) return json({ message: "Conta não encontrada" }, 404);
      const inicio = Number(url.searchParams.get("after") ?? 0);
      const fim = inicio + TAMANHO_DA_PAGINA;
      return json({
        results: conta.transacoes.slice(inicio, fim),
        next: fim < conta.transacoes.length ? `?accountId=${conta.id}&after=${fim}` : null,
      });
    }

    return json({ message: `rota não simulada: ${metodo} ${caminho}` }, 500);
  });

  return {
    fixture,
    itens,
    chamadas,
    autenticacoes: () => autenticacoes,
    /** Item criado "por fora" (como o widget faz), do usuário informado (ou sem dono, com null). */
    criarItemExterno(clientUserId: string | null) {
      const item: PluggyItem = { id: randomUUID(), status: "UPDATED", clientUserId, connector: { id: 2, name: "Pluggy Bank" } };
      itens.set(item.id, { item, consultas: 2, segurado: false, statusFinal: "UPDATED" });
      return item.id;
    },
    /** Mantém o item em UPDATING até `liberarItem`. */
    segurarItem(id: string) {
      itens.get(id)!.segurado = true;
    },
    liberarItem(id: string, status = "UPDATED") {
      const dados = itens.get(id)!;
      dados.segurado = false;
      dados.statusFinal = status;
    },
    /** Faz as chamadas que casam com `padrao` ("MÉTODO /caminho?query") responderem com este status. */
    falharEm(padrao: RegExp, status: number) {
      falhas.push({ padrao, status });
    },
    /** A apiKey atual deixa de valer: a próxima chamada recebe 401 e o cliente precisa se autenticar de novo. */
    expirarChave() {
      chaveValida = "chave-expirada";
    },
    derrubarRede() {
      rede = false;
    },
    adicionarTransacao(accountId: string, t: PluggyTransaction) {
      fixture.contas.find((c) => c.id === accountId)!.transacoes.push(t);
    },
  };
}

// Servidor Java de categorização simulado: devolve a categoria pela descrição (regras mínimas para os testes).
export function simularCategorizacao(opcoes: { indisponivel?: boolean } = {}) {
  const pedidos: { descricao: string; valor: number }[] = [];
  mock.method(javaServerClient, "enviarPedido", async (tipo: string, _resposta: string, dados: any) => {
    if (tipo !== "PedidoCategorizarTransacao") throw new Error(`Pedido inesperado ao Servidor Java: ${tipo}`);
    if (opcoes.indisponivel) throw new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE");
    pedidos.push({ descricao: dados.descricao, valor: dados.valor });
    const d = String(dados.descricao).toUpperCase();
    const categoria = /SPOTIFY|NETFLIX/.test(d) ? "Lazer" : /CONDOMINIO/.test(d) ? "Moradia" : /SALARIO/.test(d) ? "Salario" : "Outros";
    return { categoria };
  });
  return pedidos;
}
