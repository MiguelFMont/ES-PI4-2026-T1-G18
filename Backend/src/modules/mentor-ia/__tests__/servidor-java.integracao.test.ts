// src/modules/mentor-ia/__tests__/servidor-java.integracao.test.ts
// Integração Backend -> Servidor Java DE VERDADE (socket em JAVA_SERVER_HOST:JAVA_SERVER_PORT).
// Fica pulado no `npm test` comum; para rodar, suba o Servidor e defina JAVA_SERVER_INTEGRACAO=1.
// A API de IA e o MongoDB continuam simulados.
import "./ambiente";
import { after, afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { javaServerClient } from "../../../java-client/java-server.client";
import { mentorIaService } from "../mentor-ia.service";
import { mentorIaRepository } from "../mentor-ia.repository";
import { transactionsRepository } from "../../transactions/transactions.repository";
import { respostaDaIa, simularApiDeIa } from "./apoio";

const ativo = process.env.JAVA_SERVER_INTEGRACAO === "1";
const AVISO = "Não posso recomendar a compra ou a venda de ativos específicos.";

const filtrar = (resposta: string) =>
  javaServerClient.enviarPedido<{ resposta: string }, { respostaFiltrada: string }>(
    "PedidoFiltrarResposta",
    "RespostaFiltrarResposta",
    { resposta }
  );

const montarContexto = (dados: { diaDoMes: number; transacoes: unknown[] }) =>
  javaServerClient.enviarPedido<typeof dados, { contexto: string }>(
    "PedidoMontarContextoIA",
    "RespostaMontarContextoIA",
    dados
  );

describe(
  "Integração com o Servidor Java (Mentor IA)",
  { skip: !ativo && "defina JAVA_SERVER_INTEGRACAO=1 com o Servidor Java no ar" },
  () => {
    after(() => javaServerClient.fechar());
    afterEach(() => mock.restoreAll());

    test("PedidoFiltrarResposta remove a recomendação de ativo e acrescenta o aviso", async () => {
      const { respostaFiltrada } = await filtrar(
        "Você poupou 60% da renda neste mês, um ótimo resultado. Compre PETR4 agora."
      );
      assert.ok(!respostaFiltrada.includes("PETR4"), respostaFiltrada);
      assert.ok(respostaFiltrada.startsWith("Você poupou 60% da renda neste mês"), respostaFiltrada);
      assert.ok(respostaFiltrada.includes(AVISO), respostaFiltrada);
    });

    test("PedidoFiltrarResposta deixa passar recusa e texto sem ativo", async () => {
      for (const texto of ["Não posso recomendar PETR4. Posso explicar o que é uma ação.", "Reduza os gastos com lazer."]) {
        assert.equal((await filtrar(texto)).respostaFiltrada, texto);
      }
    });

    test("PedidoMontarContextoIA calcula os totais formatados em pt-BR", async () => {
      const { contexto } = await montarContexto({
        diaDoMes: 30,
        transacoes: [
          { tipo: "receita", valor: 4500, categoria: "Salário", descricao: "Salário", data: "2026-11-05T12:00:00.000Z" },
          { tipo: "despesa", valor: 1400, categoria: "Moradia", descricao: "Aluguel", data: "2026-11-05T12:00:00.000Z" },
        ],
      });
      assert.match(contexto, /receitas R\$ 4\.500,00; despesas R\$ 1\.400,00; saldo R\$ 3\.100,00/);
      assert.match(contexto, /Moradia R\$ 1\.400,00 \(100,0%\)/);
    });

    test("PedidoMontarContextoIA com diaDoMes inválido: AppError 400 VALIDATION", async () => {
      await assert.rejects(montarContexto({ diaDoMes: 0, transacoes: [] }), {
        name: "AppError",
        statusCode: 400,
        code: "VALIDATION",
      });
    });

    test("sendMessage com o filtro real: a recomendação da IA não chega ao usuário", async () => {
      mock.method(transactionsRepository, "findByUser", async () => ({
        docs: [{ tipo: "despesa", valor: 1400, categoria: "Moradia", descricao: "Aluguel", data: new Date() }],
        total: 1,
        totais: { receitas: 0, despesas: 1400 },
      }));
      mock.method(mentorIaRepository, "findRecent", async () => []);
      const salvar = mock.method(mentorIaRepository, "saveExchange", async (u: string, p: string, r: string) => [
        { _id: new Types.ObjectId(), userId: u, autor: "usuario", texto: p, createdAt: new Date() },
        { _id: new Types.ObjectId(), userId: u, autor: "ia", texto: r, createdAt: new Date() },
      ]);
      const chamadas = simularApiDeIa(() => respostaDaIa("Compre PETR4 agora."));

      const { resposta } = await mentorIaService.sendMessage("usuario-integracao", "Devo comprar PETR4?");

      assert.match(chamadas[0].corpo.messages[0].content, /Moradia R\$ 1\.400,00/); // contexto veio do Java
      assert.equal(resposta.texto, (await filtrar("Compre PETR4 agora.")).respostaFiltrada);
      assert.ok(!resposta.texto.includes("PETR4"));
      assert.ok(!String(salvar.mock.calls[0].arguments[2]).includes("PETR4"));
    });
  }
);
