// src/modules/mentor-ia/__tests__/mentor-ia.proativa.test.ts
// A mensagem proativa do Mentor (POST /v1/mentor-ia/chat/proativa): o Mentor inicia a conversa
// explicando os alertas novos. De ponta a ponta no Backend (app Express numa porta livre, MongoDB em
// memória, API de IA e Servidor Java simulados) e, no fim, o service com os repositories simulados.
// Os alertas nascem de transações reais (gasto fora do padrão no mês atual de Brasília): inserir o
// alerta direto no banco não serve, porque a rota recalcula os alertas e apaga os que não valem.
import "./ambiente";
import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { app } from "../../../http/app";
import { env } from "../../../config/env";
import { AlertModel, ChatMessageModel } from "../mentor-ia.model";
import { TransactionModel } from "../../transactions/transactions.model";
import { mentorIaService } from "../mentor-ia.service";
import { mentorIaRepository } from "../mentor-ia.repository";
import { alertasService } from "../alertas.service";
import { diaEmBrasilia, inicioDoDia } from "../datas";
import { AppError } from "../../../shared/errors/app-error";
import { encerrarBanco, iniciarBanco, limparBanco } from "./banco-de-teste";
import { respostaDaIa, simularApiDeIa, simularServidorJava } from "./apoio";

let servidor: Server;
let base: string;

const tokenDe = (id: string) => jwt.sign({ id, email: `${id}@teste.com` }, env.JWT_SECRET, { expiresIn: "1h" });
const ANA = tokenDe("ana");
const BETO = tokenDe("beto");

// O filtro simulado troca a resposta da IA por este marcador: assim dá para provar que o que é salvo e
// devolvido é a saída do filtro (Servidor Java), não o texto cru da IA.
const TEXTO_FILTRADO = "[texto devolvido pelo filtro]";
const TEXTO_DA_IA = "Seu gasto com Lazer disparou este mês. Quer conversar sobre isso?";

function requisicao(metodo: "GET" | "POST", caminho: string, token?: string, corpo?: unknown) {
  return fetch(`${base}/v1/mentor-ia${caminho}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

const proativa = (token?: string) => requisicao("POST", "/chat/proativa", token);

// corpo da resposta já como `any`, para ler os campos nos asserts
const json = (resposta: Response): Promise<any> => resposta.json();

// Transações que disparam um "gasto fora do padrão" na categoria: R$ 100 em cada um dos 2 meses
// anteriores e R$ 900 hoje (mais de 2× o maior mês e mais de R$ 200 acima dele). Só despesas no pix:
// não geram "fatura próxima" (crédito) nem "dinheiro parado" (sem receitas).
async function criarGastoForaDoPadrao(userId: string, categoria = "Lazer") {
  const agora = new Date();
  const { ano, mes } = diaEmBrasilia(agora);
  const despesa = (valor: number, data: Date, descricao: string) => ({
    userId, tipo: "despesa", valor, categoria, descricao, data, formaPagamento: "pix",
  });
  await TransactionModel.create([
    despesa(100, inicioDoDia(ano, mes - 1, 15), `${categoria} do mês passado`),
    despesa(100, inicioDoDia(ano, mes - 2, 15), `${categoria} de dois meses atrás`),
    despesa(900, agora, `${categoria} deste mês`),
  ]);
}

const alertasDe = (userId: string) => AlertModel.find({ userId }).sort({ chave: 1 }).lean();

before(async () => {
  await iniciarBanco();
  servidor = app.listen(0);
  await once(servidor, "listening");
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => servidor.close(resolve));
  await encerrarBanco();
});

beforeEach(limparBanco);
afterEach(() => mock.restoreAll());

describe("POST /v1/mentor-ia/chat/proativa", () => {
  test("sem token ou com token inválido: 401 UNAUTHENTICATED, sem chamar a IA nem o Java", async () => {
    await criarGastoForaDoPadrao("ana");
    const pedidos = simularServidorJava();
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));

    for (const token of [undefined, "token-invalido", jwt.sign({ id: "ana" }, "outro-segredo")]) {
      const resposta = await proativa(token);
      assert.equal(resposta.status, 401);
      assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    }
    assert.equal(pedidos.length, 0);
    assert.equal(chamadas.length, 0);
    assert.equal(await ChatMessageModel.countDocuments(), 0);
  });

  test("sem alerta: 200 { mensagens: [] } sem chamar a IA nem o Servidor Java", async () => {
    // transação comum, sem histórico: não gera alerta
    await TransactionModel.create({
      userId: "ana", tipo: "despesa", valor: 50, categoria: "Lazer", descricao: "Cinema", data: new Date(), formaPagamento: "pix",
    });
    const pedidos = simularServidorJava();
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));

    const resposta = await proativa(ANA);
    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { mensagens: [] });

    assert.equal(pedidos.length, 0);
    assert.equal(chamadas.length, 0);
    assert.equal(await ChatMessageModel.countDocuments(), 0);
  });

  test("com alerta novo: uma mensagem da IA (proativa), com o texto do filtro, e o alerta fica explicado", async () => {
    await criarGastoForaDoPadrao("ana");
    const pedidos = simularServidorJava({ contexto: "Mês atual: despesas R$ 900,00.", filtrar: () => TEXTO_FILTRADO });
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));

    const resposta = await proativa(ANA);
    assert.equal(resposta.status, 200);
    const { mensagens } = await json(resposta);

    // exatamente uma mensagem, da IA, marcada como proativa, com o texto que saiu do filtro
    assert.equal(mensagens.length, 1);
    const [m] = mensagens;
    assert.deepEqual(Object.keys(m).sort(), ["autor", "criadaEm", "id", "proativa", "texto"]);
    assert.equal(m.autor, "ia");
    assert.equal(m.proativa, true);
    assert.equal(m.texto, TEXTO_FILTRADO);
    assert.ok(!Number.isNaN(Date.parse(m.criadaEm)));

    // contexto (Java) -> IA -> filtro (Java): o filtro recebeu o texto cru da IA
    assert.deepEqual(
      pedidos.map((p) => p.tipo),
      ["PedidoMontarContextoIA", "PedidoFiltrarResposta"]
    );
    assert.equal(pedidos[1].dados.resposta, TEXTO_DA_IA);

    // a IA recebeu, no contexto (mensagem system), o resumo do Java e o título e a mensagem do alerta
    const [alerta] = await alertasDe("ana");
    assert.equal(alerta.tipo, "gasto_fora_do_padrao");
    assert.equal(chamadas.length, 1);
    const sistema = chamadas[0].corpo.messages[0];
    assert.equal(sistema.role, "system");
    assert.ok(sistema.content.includes("Mês atual: despesas R$ 900,00."));
    assert.ok(sistema.content.includes(`- ${alerta.titulo}: ${alerta.mensagem}`), sistema.content);
    // sem histórico no prompt: só o system e a instrução interna
    assert.equal(chamadas[0].corpo.messages.length, 2);
    assert.match(chamadas[0].corpo.messages[1].content, /Instrução interna/);

    // salvo só a mensagem da IA (a instrução interna não vai para o histórico), já filtrada
    const salvas = await ChatMessageModel.find({ userId: "ana" }).lean();
    assert.equal(salvas.length, 1);
    assert.equal(salvas[0].autor, "ia");
    assert.equal(salvas[0].proativa, true);
    assert.equal(salvas[0].texto, TEXTO_FILTRADO);
    assert.equal(salvas[0]._id.toString(), m.id);
    assert.equal(await ChatMessageModel.countDocuments({ texto: TEXTO_DA_IA }), 0);

    // o alerta ganhou explicadoEm, mas continua não lido (segue aparecendo em GET /alerts)
    assert.ok(alerta.explicadoEm instanceof Date);
    assert.equal(alerta.lido, false);
    const alertas = await json(await requisicao("GET", "/alerts", ANA));
    assert.deepEqual(alertas.map((a: { id: string }) => a.id), [alerta._id.toString()]);
  });

  test("segunda chamada sem alerta novo: [] e não chama a IA de novo", async () => {
    await criarGastoForaDoPadrao("ana");
    const pedidos = simularServidorJava();
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));

    assert.equal((await json(await proativa(ANA))).mensagens.length, 1);
    const resposta = await proativa(ANA);
    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { mensagens: [] });

    assert.equal(chamadas.length, 1);
    assert.equal(pedidos.length, 2);
    assert.equal(await ChatMessageModel.countDocuments(), 1);
  });

  test("alerta novo depois de uma explicação: a nova mensagem explica só o alerta novo", async () => {
    await criarGastoForaDoPadrao("ana", "Lazer");
    simularServidorJava();
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));
    assert.equal((await json(await proativa(ANA))).mensagens.length, 1);

    await criarGastoForaDoPadrao("ana", "Vestuario");
    const { mensagens } = await json(await proativa(ANA));
    assert.equal(mensagens.length, 1);

    const contexto = chamadas[1].corpo.messages[0].content;
    assert.ok(contexto.includes("Gasto fora do padrão em Vestuario"));
    assert.ok(!contexto.includes("Gasto fora do padrão em Lazer"));
    assert.equal(await ChatMessageModel.countDocuments({ proativa: true }), 2);
    assert.ok((await alertasDe("ana")).every((a) => a.explicadoEm instanceof Date));
  });

  test("erros da IA e do Servidor Java: status do contrato, nada é salvo e o alerta segue sem explicação", async () => {
    mock.method(console, "error", () => {});
    await criarGastoForaDoPadrao("ana");

    const casos: { preparar: () => void; status: number; code: string }[] = [
      { preparar: () => simularApiDeIa(() => new Response("", { status: 429 })), status: 429, code: "GENAI_RATE_LIMITED" },
      { preparar: () => simularApiDeIa(() => new Response("", { status: 503 })), status: 502, code: "GENAI_ERROR" },
      { preparar: () => simularApiDeIa(() => Promise.reject(new TypeError("fetch failed"))), status: 503, code: "GENAI_UNAVAILABLE" },
      {
        // a IA respondeu, mas o filtro falhou: a resposta sem filtro não pode ser salva
        preparar: () => {
          simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));
          simularServidorJava({
            falhar: { tipo: "PedidoFiltrarResposta", erro: new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE") },
          });
        },
        status: 503,
        code: "JAVA_SERVER_UNAVAILABLE",
      },
    ];
    for (const caso of casos) {
      simularServidorJava();
      caso.preparar();
      const resposta = await proativa(ANA);
      assert.equal(resposta.status, caso.status, caso.code);
      assert.equal((await json(resposta)).error.code, caso.code);

      assert.equal(await ChatMessageModel.countDocuments(), 0, caso.code);
      const alertas = await alertasDe("ana");
      assert.equal(alertas.length, 1);
      assert.equal(alertas[0].explicadoEm, undefined, caso.code);

      mock.restoreAll();
      mock.method(console, "error", () => {});
    }

    // na próxima abertura, com a IA de volta, o alerta é explicado
    simularServidorJava({ filtrar: () => TEXTO_FILTRADO });
    simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));
    const { mensagens } = await json(await proativa(ANA));
    assert.equal(mensagens.length, 1);
    assert.equal(mensagens[0].texto, TEXTO_FILTRADO);
    assert.ok((await alertasDe("ana"))[0].explicadoEm instanceof Date);
  });

  test("duas chamadas ao mesmo tempo (duas abas): só uma mensagem é salva e a outra devolve []", async () => {
    await criarGastoForaDoPadrao("ana");
    simularServidorJava();

    // A IA só responde quando as duas chamadas chegaram a ela (ou depois de 1 s): assim as duas
    // leram o alerta como não explicado antes de qualquer uma marcar.
    let liberar: () => void = () => {};
    const ambasChegaram = new Promise<void>((resolve) => {
      liberar = resolve;
      setTimeout(resolve, 1000).unref();
    });
    const chamadas = simularApiDeIa(async () => {
      if (chamadas.length === 2) liberar();
      await ambasChegaram;
      return respostaDaIa(TEXTO_DA_IA);
    });

    const respostas = await Promise.all([proativa(ANA), proativa(ANA)]);
    const corpos = await Promise.all(respostas.map(json));
    assert.deepEqual(respostas.map((r) => r.status), [200, 200]);

    // as duas chegaram à IA (a corrida aconteceu de fato), mas só uma explicação foi salva
    assert.equal(chamadas.length, 2);
    assert.deepEqual(corpos.map((c) => c.mensagens.length).sort(), [0, 1]);
    assert.equal(await ChatMessageModel.countDocuments({ userId: "ana" }), 1);
    const [alerta] = await alertasDe("ana");
    assert.ok(alerta.explicadoEm instanceof Date);
    assert.equal(await AlertModel.countDocuments({ userId: "ana" }), 1);
  });

  test("histórico: GET /chat traz a mensagem proativa com proativa: true e as demais sem o campo", async () => {
    await criarGastoForaDoPadrao("ana");
    simularServidorJava();
    // a chamada proativa manda a instrução interna no lugar da pergunta
    simularApiDeIa(({ corpo }) => {
      const ultima = corpo.messages.at(-1)!.content;
      return respostaDaIa(ultima.includes("Instrução interna") ? "explicação dos padrões" : `resposta para: ${ultima}`);
    });

    assert.equal((await requisicao("POST", "/chat", ANA, { texto: "Oi" })).status, 200);
    assert.equal((await json(await proativa(ANA))).mensagens.length, 1);

    const historico = await json(await requisicao("GET", "/chat", ANA));
    assert.deepEqual(
      historico.map((m: { autor: string; texto: string; proativa?: boolean }) => [m.autor, m.texto, m.proativa]),
      [
        ["usuario", "Oi", undefined],
        ["ia", "resposta para: Oi", undefined],
        ["ia", "explicação dos padrões", true],
      ]
    );
    // nas mensagens comuns o campo não vem (nem como false)
    assert.ok(!("proativa" in historico[0]));
    assert.ok(!("proativa" in historico[1]));
    assert.deepEqual(Object.keys(historico[2]).sort(), ["autor", "criadaEm", "id", "proativa", "texto"]);
  });

  test("isolamento: a chamada do Beto não explica os alertas da Ana", async () => {
    await criarGastoForaDoPadrao("ana");
    const pedidos = simularServidorJava();
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));

    // gera o alerta da Ana (como o sino faria) antes da chamada do Beto
    assert.equal((await json(await requisicao("GET", "/alerts", ANA))).length, 1);

    const doBeto = await proativa(BETO);
    assert.equal(doBeto.status, 200);
    assert.deepEqual(await json(doBeto), { mensagens: [] });
    assert.equal(chamadas.length, 0);
    assert.equal(pedidos.length, 0);
    assert.equal((await alertasDe("ana"))[0].explicadoEm, undefined);
    assert.equal(await ChatMessageModel.countDocuments(), 0);

    // o alerta da Ana segue disponível para ela, e a mensagem fica só no histórico dela
    assert.equal((await json(await proativa(ANA))).mensagens.length, 1);
    assert.deepEqual(await json(await requisicao("GET", "/chat", BETO)), []);
    assert.equal((await json(await requisicao("GET", "/chat", ANA))).length, 1);
  });
});

describe("mentorIaService.proactiveMessage (repositories simulados)", () => {
  const USUARIO = "usuario-1";
  const alerta = {
    id: "6af1be0a9322b6d9b51951c1",
    tipo: "gasto_fora_do_padrao" as const,
    titulo: "Gasto fora do padrão em Lazer",
    mensagem: "Em novembro você já gastou R$ 900,00 com Lazer.",
    dados: {},
    lido: false,
    criadaEm: "2026-11-09T12:00:00.000Z",
  };

  test("sem alerta não explicado: [] sem montar contexto, chamar a IA ou salvar", async () => {
    mock.method(alertasService, "listarNaoExplicados", async () => []);
    const marcar = mock.method(alertasService, "marcarComoExplicados", async () => 0).mock;
    const salvar = mock.method(mentorIaRepository, "saveMensagemProativa", async () => {
      throw new Error("não deveria salvar");
    }).mock;
    const pedidos = simularServidorJava();
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));

    assert.deepEqual(await mentorIaService.proactiveMessage(USUARIO), { mensagens: [] });
    assert.equal(pedidos.length, 0);
    assert.equal(chamadas.length, 0);
    assert.equal(marcar.callCount(), 0);
    assert.equal(salvar.callCount(), 0);
  });

  test("marca os alertas listados antes de salvar; se outra chamada já marcou (0), descarta a mensagem", async () => {
    mock.method(alertasService, "listarNaoExplicados", async () => [alerta]);
    const marcar = mock.method(alertasService, "marcarComoExplicados", async () => 0).mock;
    const salvar = mock.method(mentorIaRepository, "saveMensagemProativa", async () => {
      throw new Error("não deveria salvar");
    }).mock;
    simularServidorJava({ filtrar: () => TEXTO_FILTRADO });
    const chamadas = simularApiDeIa(() => respostaDaIa(TEXTO_DA_IA));

    assert.deepEqual(await mentorIaService.proactiveMessage(USUARIO), { mensagens: [] });
    assert.equal(chamadas.length, 1);
    assert.deepEqual(marcar.calls[0].arguments, [USUARIO, [alerta.id]]);
    assert.equal(salvar.callCount(), 0);
  });

  test("falha da IA: não marca nem salva e propaga o erro", async () => {
    mock.method(alertasService, "listarNaoExplicados", async () => [alerta]);
    const marcar = mock.method(alertasService, "marcarComoExplicados", async () => 1).mock;
    const salvar = mock.method(mentorIaRepository, "saveMensagemProativa", async () => {
      throw new Error("não deveria salvar");
    }).mock;
    const pedidos = simularServidorJava();
    simularApiDeIa(() => new Response("", { status: 429 }));

    await assert.rejects(mentorIaService.proactiveMessage(USUARIO), { code: "GENAI_RATE_LIMITED" });
    assert.deepEqual(pedidos.map((p) => p.tipo), ["PedidoMontarContextoIA"]);
    assert.equal(marcar.callCount(), 0);
    assert.equal(salvar.callCount(), 0);
  });
});
