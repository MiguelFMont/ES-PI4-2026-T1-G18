// src/modules/mentor-ia/__tests__/mentor-ia.service.test.ts
// O service com os repositories, a API de IA e o Servidor Java simulados (sem banco nem rede).
import "./ambiente";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { mentorIaService } from "../mentor-ia.service";
import { mentorIaRepository } from "../mentor-ia.repository";
import { transactionsRepository } from "../../transactions/transactions.repository";
import { AppError } from "../../../shared/errors/app-error";
import { respostaDaIa, simularApiDeIa, simularServidorJava } from "./apoio";

const USUARIO = "usuario-1";
const AVISO_SIMULADO = "Não posso recomendar a compra ou a venda de ativos específicos.";

// mensagem como o repository devolve (lean / toObject)
function mensagem(autor: "usuario" | "ia", texto: string, criadaEm = new Date("2026-11-05T12:00:00.000Z")) {
  return { _id: new Types.ObjectId(), userId: USUARIO, autor, texto, createdAt: criadaEm, updatedAt: criadaEm };
}

const transacaoDoBanco = {
  _id: new Types.ObjectId(),
  userId: USUARIO,
  tipo: "despesa" as const,
  valor: 1400,
  categoria: "Moradia",
  descricao: "Aluguel",
  observacoes: "anotação pessoal",
  formaPagamento: "pix" as const,
  origem: "manual" as const,
  data: new Date("2026-11-05T12:00:00.000Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

let anteriores: ReturnType<typeof mensagem>[];
// só o que os testes leem do mock: os argumentos de cada chamada
type Chamadas = { calls: { arguments: any[] }[] };

let buscarTransacoes: Chamadas;
let buscarRecentes: Chamadas;
let salvarTroca: Chamadas;

beforeEach(() => {
  anteriores = [mensagem("usuario", "Quanto gastei?"), mensagem("ia", "Você gastou R$ 1.400,00.")];

  buscarTransacoes = mock.method(transactionsRepository, "findByUser", async () => ({
    docs: [transacaoDoBanco],
    total: 1,
    totais: { receitas: 0, despesas: 1400 },
  })).mock;
  buscarRecentes = mock.method(mentorIaRepository, "findRecent", async () => anteriores).mock;
  salvarTroca = mock.method(mentorIaRepository, "saveExchange", async (_u: string, pergunta: string, resposta: string) => [
    mensagem("usuario", pergunta),
    mensagem("ia", resposta),
  ]).mock;
});

afterEach(() => mock.restoreAll());

describe("mentorIaService.sendMessage", () => {
  test("fluxo pergunta/resposta: contexto (Java) -> IA -> filtro (Java) -> histórico", async () => {
    const pedidos = simularServidorJava({ contexto: "Mês atual: despesas R$ 1.400,00." });
    const chamadas = simularApiDeIa(() => respostaDaIa("Reduza os gastos com moradia."));

    const resultado = await mentorIaService.sendMessage(USUARIO, "Como economizar?");

    // dados lidos do usuário certo; histórico limitado a 6 mensagens
    assert.equal(buscarTransacoes.calls[0].arguments[0], USUARIO);
    assert.deepEqual(buscarRecentes.calls[0].arguments, [USUARIO, 6]);

    // 1) contexto: só os campos necessários das transações, sem userId nem dados da conta
    assert.deepEqual(
      pedidos.map((p) => p.tipo),
      ["PedidoMontarContextoIA", "PedidoFiltrarResposta"]
    );
    const { diaDoMes, transacoes } = pedidos[0].dados;
    assert.ok(Number.isInteger(diaDoMes) && diaDoMes >= 1 && diaDoMes <= 31);
    assert.deepEqual(transacoes, [
      { tipo: "despesa", valor: 1400, categoria: "Moradia", descricao: "Aluguel", data: "2026-11-05T12:00:00.000Z" },
    ]);
    assert.ok(!JSON.stringify(pedidos).includes(USUARIO), "o userId não pode ir para o Servidor Java");

    // 2) IA: recebe o contexto devolvido pelo Java e o histórico
    const { messages } = chamadas[0].corpo;
    assert.match(messages[0].content, /Resumo financeiro do usuário: Mês atual: despesas R\$ 1\.400,00\./);
    assert.deepEqual(messages.slice(1), [
      { role: "user", content: "Quanto gastei?" },
      { role: "assistant", content: "Você gastou R$ 1.400,00." },
      { role: "user", content: "Como economizar?" },
    ]);

    // 3) filtro: recebe a resposta crua da IA
    assert.deepEqual(pedidos[1].dados, { resposta: "Reduza os gastos com moradia." });

    // 4) histórico e retorno
    assert.deepEqual(salvarTroca.calls[0].arguments, [USUARIO, "Como economizar?", "Reduza os gastos com moradia."]);
    assert.equal(resultado.pergunta.autor, "usuario");
    assert.equal(resultado.pergunta.texto, "Como economizar?");
    assert.equal(resultado.resposta.autor, "ia");
    assert.equal(resultado.resposta.texto, "Reduza os gastos com moradia.");
    assert.match(resultado.resposta.id, /^[0-9a-f]{24}$/);
    assert.equal(resultado.resposta.criadaEm, "2026-11-05T12:00:00.000Z");
    assert.deepEqual(Object.keys(resultado.resposta).sort(), ["autor", "criadaEm", "id", "texto"]);
  });

  test("usa o mês de Brasília: dataInicio no dia 1 às 00:00 de Brasília e diaDoMes de hoje", async (t) => {
    simularApiDeIa(() => respostaDaIa("ok"));
    const pedidos = simularServidorJava();

    const casos = [
      // 01/11 02:00 UTC ainda é 31/10 23:00 em Brasília
      { agora: "2026-11-01T02:00:00.000Z", inicio: "2026-10-01T03:00:00.000Z", dia: 31 },
      { agora: "2026-11-15T15:00:00.000Z", inicio: "2026-11-01T03:00:00.000Z", dia: 15 },
    ];
    for (const caso of casos) {
      t.mock.timers.enable({ apis: ["Date"], now: new Date(caso.agora) });
      await mentorIaService.sendMessage(USUARIO, "Oi");
      t.mock.timers.reset();

      const filtros = buscarTransacoes.calls.at(-1)!.arguments[1] as Record<string, unknown>;
      assert.deepEqual(filtros, { dataInicio: new Date(caso.inicio), pagina: 1, limite: 100 });
      assert.equal(pedidos.at(-2)!.dados.diaDoMes, caso.dia);
    }
  });

  test("a resposta salva e devolvida é a FILTRADA, nunca a recomendação crua da IA", async () => {
    const recomendacao = "Compre PETR4 agora. Ela vai subir.";
    const pedidos = simularServidorJava({ filtrar: () => AVISO_SIMULADO });
    simularApiDeIa(() => respostaDaIa(recomendacao));

    const resultado = await mentorIaService.sendMessage(USUARIO, "Devo comprar PETR4?");

    assert.deepEqual(pedidos[1].dados, { resposta: recomendacao });
    assert.equal(salvarTroca.calls[0].arguments[2], AVISO_SIMULADO);
    assert.equal(resultado.resposta.texto, AVISO_SIMULADO);
    assert.ok(!JSON.stringify(resultado).includes("Compre PETR4"));
  });

  test("se a IA falha, nada é salvo e a resposta não passa pelo filtro", async () => {
    const pedidos = simularServidorJava();
    simularApiDeIa(() => new Response("limite", { status: 429 }));

    await assert.rejects(mentorIaService.sendMessage(USUARIO, "Oi"), { code: "GENAI_RATE_LIMITED" });
    assert.equal(salvarTroca.calls.length, 0);
    assert.deepEqual(
      pedidos.map((p) => p.tipo),
      ["PedidoMontarContextoIA"]
    );
  });

  test("se o Servidor Java está fora ao montar o contexto, a IA não é chamada e nada é salvo", async () => {
    simularServidorJava({
      falhar: { tipo: "PedidoMontarContextoIA", erro: new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE") },
    });
    const chamadas = simularApiDeIa(() => respostaDaIa("ok"));

    await assert.rejects(mentorIaService.sendMessage(USUARIO, "Oi"), { statusCode: 503, code: "JAVA_SERVER_UNAVAILABLE" });
    assert.equal(chamadas.length, 0);
    assert.equal(salvarTroca.calls.length, 0);
  });

  test("se o filtro falha, a resposta crua da IA não é salva nem devolvida", async () => {
    simularServidorJava({
      falhar: { tipo: "PedidoFiltrarResposta", erro: new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE") },
    });
    simularApiDeIa(() => respostaDaIa("Compre PETR4 agora."));

    await assert.rejects(mentorIaService.sendMessage(USUARIO, "Oi"), { code: "JAVA_SERVER_UNAVAILABLE" });
    assert.equal(salvarTroca.calls.length, 0);
  });
});

describe("mentorIaService.getHistory", () => {
  test("devolve as últimas 50 mensagens como DTO (id, autor, texto, criadaEm), sem userId", async () => {
    const historico = await mentorIaService.getHistory(USUARIO);

    assert.deepEqual(buscarRecentes.calls[0].arguments, [USUARIO, 50]);
    assert.deepEqual(historico, [
      { id: anteriores[0]._id.toString(), autor: "usuario", texto: "Quanto gastei?", criadaEm: "2026-11-05T12:00:00.000Z" },
      { id: anteriores[1]._id.toString(), autor: "ia", texto: "Você gastou R$ 1.400,00.", criadaEm: "2026-11-05T12:00:00.000Z" },
    ]);
  });

  test("sem conversa, devolve []", async () => {
    anteriores = [];
    assert.deepEqual(await mentorIaService.getHistory(USUARIO), []);
  });
});
