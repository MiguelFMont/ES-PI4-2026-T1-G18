// src/modules/connected-accounts/__tests__/pluggy.mapper.test.ts
// A conversão Pluggy -> FinanceAI, testada com as transações reais do sandbox (a fixture) e com casos de borda.
import "./ambiente";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ehPagamentoDeFatura, mapearTransacao } from "../../../integrations/pluggy/pluggy.mapper";
import { PluggyTransaction } from "../../../integrations/pluggy/pluggy.types";
import { carregarFixture } from "./apoio";

const base: PluggyTransaction = { id: "t-1", description: "PADARIA", amount: -12.5, date: "2026-11-05T03:00:00.000Z", status: "POSTED" };

describe("mapearTransacao: regras", () => {
  test("o sinal do amount decide receita ou despesa (negativo = despesa)", () => {
    const despesa = mapearTransacao({ ...base, amount: -50 }, "BANK");
    const receita = mapearTransacao({ ...base, amount: 50 }, "BANK");
    assert.ok(despesa.ok && receita.ok);
    assert.equal(despesa.ok && despesa.transacao.tipo, "despesa");
    assert.equal(receita.ok && receita.transacao.tipo, "receita");
  });

  test("o valor gravado é sempre positivo e arredondado em 2 casas", () => {
    const r = mapearTransacao({ ...base, amount: -10.005 }, "BANK");
    assert.ok(r.ok);
    assert.equal(r.ok && r.transacao.valor, 10.01);
  });

  test("no cartão de crédito, type CREDIT com amount negativo é DESPESA (o type não decide)", () => {
    const r = mapearTransacao({ ...base, type: "CREDIT", amount: -21.9 }, "CREDIT");
    assert.ok(r.ok);
    assert.equal(r.ok && r.transacao.tipo, "despesa");
    assert.equal(r.ok && r.transacao.formaPagamento, "credito");
  });

  test("a forma de pagamento: boleto pelo paymentData, pix pelo operationType, cartão pela conta, senão outro", () => {
    const forma = (t: Partial<PluggyTransaction>, conta = "BANK") => {
      const r = mapearTransacao({ ...base, ...t }, conta);
      return r.ok ? r.transacao.formaPagamento : r.motivo;
    };
    assert.equal(forma({ paymentData: { paymentMethod: "BOLETO" } }), "boleto");
    assert.equal(forma({ operationType: "PIX" }), "pix");
    assert.equal(forma({}, "CREDIT"), "credito");
    assert.equal(forma({}), "outro");
  });

  test("guarda o id da Pluggy como externalId e a data como Date", () => {
    const r = mapearTransacao(base, "BANK");
    assert.ok(r.ok);
    assert.equal(r.ok && r.transacao.externalId, "t-1");
    assert.ok(r.ok && r.transacao.data instanceof Date);
  });

  test("não copia o paymentData (dados de terceiros)", () => {
    const r = mapearTransacao({ ...base, paymentData: { paymentMethod: "BOLETO", payer: { name: "Fulano", documentNumber: { value: "111" } } } as any }, "BANK");
    assert.ok(r.ok);
    assert.doesNotMatch(JSON.stringify(r), /Fulano|111/);
  });

  test("ignora pendentes, zeradas e inválidas, informando o motivo", () => {
    assert.deepEqual(mapearTransacao({ ...base, status: "PENDING" }, "BANK"), { ok: false, motivo: "pendente" });
    assert.deepEqual(mapearTransacao({ ...base, amount: 0 }, "BANK"), { ok: false, motivo: "zerada" });
    assert.deepEqual(mapearTransacao({ ...base, id: "" }, "BANK"), { ok: false, motivo: "invalida" });
    assert.deepEqual(mapearTransacao({ ...base, date: "isso não é data" }, "BANK"), { ok: false, motivo: "invalida" });
    assert.deepEqual(mapearTransacao({ ...base, amount: Number.NaN }, "BANK"), { ok: false, motivo: "invalida" });
  });

  test("descrição em branco ganha um texto padrão", () => {
    const r = mapearTransacao({ ...base, description: "   " }, "BANK");
    assert.ok(r.ok);
    assert.equal(r.ok && r.transacao.descricao, "Transação importada");
  });
});

describe("ehPagamentoDeFatura", () => {
  test("reconhece o pagamento da fatura do cartão", () => {
    for (const d of ["PAGAMENTO FATURA CARTAO VISA", "Fatura do cartão Nubank", "pagamento fatura", "PGTO FATURA CARTÃO"]) {
      assert.equal(ehPagamentoDeFatura(d), true, d);
    }
  });

  test("não confunde com outras faturas ou com compras no cartão", () => {
    for (const d of ["FATURA DE ENERGIA", "CONDOMINIO EDIFICIO SOLAR", "ANUIDADE CARTAO DE CREDITO", "SPOTIFY AB"]) {
      assert.equal(ehPagamentoDeFatura(d), false, d);
    }
  });
});

describe("mapearTransacao: os dados reais do sandbox (fixture)", () => {
  const { contas } = carregarFixture();
  const todas = contas.flatMap((c) => c.transacoes.map((t) => ({ t, conta: c.type })));
  const resultados = todas.map(({ t, conta }) => ({ t, r: mapearTransacao(t, conta) }));

  test("todas as 48 viram importáveis ou ignoradas com motivo (nada se perde)", () => {
    assert.equal(resultados.length, 48);
    for (const { r } of resultados) assert.ok(r.ok || ["pendente", "zerada", "faturaCartao", "invalida"].includes(r.motivo));
  });

  test("o pagamento da fatura é a única coisa ignorada, e só ele", () => {
    const ignoradas = resultados.filter(({ r }) => !r.ok);
    assert.ok(ignoradas.length > 0);
    for (const { t, r } of ignoradas) {
      assert.equal(r.ok ? "" : r.motivo, "faturaCartao", t.description ?? "");
      assert.match(t.description ?? "", /FATURA CARTAO/i);
    }
  });

  test("as compras do cartão viram despesas de crédito (todas negativas na Pluggy)", () => {
    const doCartao = resultados.filter(({ t }) => contas.find((c) => c.transacoes.includes(t))!.type === "CREDIT");
    assert.ok(doCartao.length > 0);
    for (const { r } of doCartao) {
      assert.ok(r.ok);
      assert.equal(r.ok && r.transacao.tipo, "despesa");
      assert.equal(r.ok && r.transacao.formaPagamento, "credito");
    }
  });

  test("tipo e valor batem com o sinal do amount em todas as importáveis", () => {
    for (const { t, r } of resultados) {
      if (!r.ok) continue;
      assert.equal(r.transacao.tipo, t.amount < 0 ? "despesa" : "receita");
      assert.equal(r.transacao.valor, Math.round(Math.abs(t.amount) * 100) / 100);
      assert.ok(r.transacao.valor > 0);
    }
  });

  test("os ids da Pluggy são únicos (servem de chave contra duplicatas)", () => {
    const ids = resultados.filter(({ r }) => r.ok).map(({ r }) => (r.ok ? r.transacao.externalId : ""));
    assert.equal(new Set(ids).size, ids.length);
  });
});
