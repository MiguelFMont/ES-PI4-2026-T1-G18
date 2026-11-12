// src/modules/mentor-ia/__tests__/apoio.ts
// Dublês usados pelos testes do Mentor IA: a API de IA (fetch) e o Servidor Java (javaServerClient).
// Usam o `mock` global do node:test: cada arquivo chama mock.restoreAll() no afterEach.
import { mock } from "node:test";
import { env } from "../../../config/env";
import { javaServerClient } from "../../../java-client/java-server.client";

export interface ChamadaDaIa {
  url: string;
  init: RequestInit;
  corpo: { model: string; messages: { role: string; content: string }[] };
}

type RespostaSimulada = Response | Promise<Response>;

const fetchOriginal = globalThis.fetch;

// Intercepta só as chamadas para GENAI_BASE_URL; as demais (ex.: os testes de rota chamando
// o app local) seguem para o fetch de verdade.
export function simularApiDeIa(responder: (chamada: ChamadaDaIa) => RespostaSimulada) {
  const chamadas: ChamadaDaIa[] = [];
  mock.method(globalThis, "fetch", (entrada: string | URL | Request, init: RequestInit = {}) => {
    const url = entrada instanceof Request ? entrada.url : String(entrada);
    if (!url.startsWith(env.GENAI_BASE_URL)) return fetchOriginal(entrada, init);
    const chamada: ChamadaDaIa = { url, init, corpo: JSON.parse(String(init.body)) };
    chamadas.push(chamada);
    return responder(chamada);
  });
  return chamadas;
}

// Resposta 200 no formato /chat/completions
export function respostaDaIa(conteudo: string): Response {
  return Response.json({ choices: [{ message: { role: "assistant", content: conteudo } }] });
}

export interface PedidoAoJava {
  tipo: string;
  dados: any;
}

// Simula o Servidor Java: o contexto é fixo e o filtro, por padrão, devolve a resposta sem mudança.
// `falhar` permite simular um erro em um tipo de pedido.
export function simularServidorJava(
  opcoes: {
    contexto?: string;
    filtrar?: (resposta: string) => string;
    falhar?: { tipo: string; erro: Error };
  } = {}
) {
  const pedidos: PedidoAoJava[] = [];
  mock.method(javaServerClient, "enviarPedido", async (tipo: string, _tipoResposta: string, dados: any) => {
    pedidos.push({ tipo, dados });
    if (opcoes.falhar?.tipo === tipo) throw opcoes.falhar.erro;
    if (tipo === "PedidoMontarContextoIA") return { contexto: opcoes.contexto ?? "CONTEXTO DE TESTE" };
    if (tipo === "PedidoFiltrarResposta") {
      return { respostaFiltrada: (opcoes.filtrar ?? ((r) => r))(dados.resposta) };
    }
    throw new Error(`Pedido inesperado ao Servidor Java: ${tipo}`);
  });
  return pedidos;
}
