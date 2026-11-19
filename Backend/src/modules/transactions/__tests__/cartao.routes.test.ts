// src/modules/transactions/__tests__/cartao.routes.test.ts
// Compras no crédito ligadas a um cartão e parceladas (/v1/transactions com cartaoId e parcelas): o parcelamento criado no
// cartão, a fatura sem contar a mesma compra duas vezes, edição em lote segura, duplicar, excluir e os erros.
// O Servidor Java é simulado só onde a fatura é lida (a transação em si não depende dele).
import { ANA, BETO, ID_INEXISTENTE, inserir, json, prepararApi, simularServidorGrupo5, textoDe } from "../../goals/__tests__/apoio";
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CardInstallmentModel, CardModel } from "../../investments/investments.model";
import { TransactionModel } from "../transactions.model";

const { chamar } = prepararApi();

// Criar e ler cartões calcula a fatura no Servidor Java: ele é simulado em todos os testes deste arquivo.
beforeEach(() => {
  simularServidorGrupo5();
});

const tx = (metodo: string, caminho: string, corpo?: unknown, token: string | null = ANA) =>
  chamar(metodo, `/transactions${caminho}`, token ?? undefined, corpo);
const inv = (metodo: string, caminho: string, corpo?: unknown, token: string | null = ANA) =>
  chamar(metodo, `/investments${caminho}`, token ?? undefined, corpo);

const criarCartao = async (nome: string, token: string | null = ANA) => json(await inv("POST", "/cards", { nome }, token));
const COMPRA = { tipo: "despesa", valor: 900, categoria: "Lazer", data: "2026-10-05T12:00:00.000Z", descricao: "Notebook", formaPagamento: "credito" };
const criar = async (extra: Record<string, unknown> = {}, token: string | null = ANA) => tx("POST", "", { ...COMPRA, ...extra }, token);
const criada = async (extra: Record<string, unknown> = {}, token: string | null = ANA) => json(await criar(extra, token));
const editar = (id: string, alteracoes: Record<string, unknown>, token: string | null = ANA) =>
  tx("PATCH", "/bulk", { itens: [{ id, alteracoes }] }, token);
const excluir = (ids: string[], token: string | null = ANA) => tx("POST", "/bulk-delete", { ids }, token);
const doBanco = (id: string) => TransactionModel.findById(id).lean();
const parcelamentoDoBanco = (id: string) => CardInstallmentModel.findById(id).lean();

// ------------------------------------------------------------------------------------------------ cadastrar

describe("POST /v1/transactions: cartão e parcelas", () => {
  test("crédito com cartaoId: guarda o cartão, parcelas 1 (à vista) e não cria parcelamento", async () => {
    const cartao = await criarCartao("Nubank");
    const resposta = await criar({ cartaoId: cartao.id });
    const t = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.equal(t.cartaoId, cartao.id);
    assert.equal(t.parcelas, 1);
    assert.equal(t.parcelamentoId, undefined);
    assert.equal(await CardInstallmentModel.countDocuments(), 0);
    assert.equal((await doBanco(t.id))?.cartaoId, cartao.id);
  });

  test("crédito sem cartaoId nem parcelas: segue como antes (sem cartaoId, parcelas 1)", async () => {
    const t = await criada();
    assert.equal(t.cartaoId, undefined);
    assert.equal(t.parcelas, 1);
    assert.equal(await CardModel.countDocuments(), 0, "nenhum cartão é criado só por registrar a compra");
  });

  test("outras formas de pagamento não trazem cartaoId nem parcelas na resposta; parcelas 1 é aceito", async () => {
    const t = await criada({ formaPagamento: "pix", parcelas: 1 });
    assert.equal(t.cartaoId, undefined);
    assert.equal(t.parcelas, undefined);
    assert.equal((await doBanco(t.id))?.parcelas, undefined);
  });

  test("parcelas > 1 cria o parcelamento no cartão (valor total, sem juros, nenhuma parcela paga) e liga a transação a ele", async () => {
    const cartao = await criarCartao("Nubank");
    const t = await criada({ cartaoId: cartao.id, parcelas: 3, descricao: "Notebook Dell" });

    assert.equal(t.parcelas, 3);
    assert.match(t.parcelamentoId, /^[a-f\d]{24}$/);
    const p = await parcelamentoDoBanco(t.parcelamentoId);
    assert.equal(p?.userId, "ana");
    assert.equal(p?.cartaoId, cartao.id);
    assert.equal(p?.descricao, "Notebook Dell");
    assert.equal(p?.valorTotal, 900);
    assert.equal(p?.parcelas, 3);
    assert.equal(p?.parcelasPagas, 0);
    assert.equal(p?.taxaJurosMensal, 0);
    assert.equal(await CardInstallmentModel.countDocuments(), 1);
  });

  test("parcelada sem cartaoId: fica no cartão mais antigo (e a transação passa a apontar para ele)", async () => {
    const primeiro = await criarCartao("Primeiro");
    await criarCartao("Segundo");
    const t = await criada({ parcelas: 2 });
    assert.equal(t.cartaoId, primeiro.id);
    assert.equal((await parcelamentoDoBanco(t.parcelamentoId))?.cartaoId, primeiro.id);
  });

  test("parcelada de quem ainda não tem cartão: cria o padrão 'Cartão' e usa ele", async () => {
    const t = await criada({ parcelas: 2 });
    const cartao = await CardModel.findOne({ userId: "ana" }).lean();
    assert.equal(cartao?.nome, "Cartão");
    assert.equal(t.cartaoId, String(cartao?._id));
  });

  test("descrição longa (a da transação não tem limite): o parcelamento guarda os 100 primeiros caracteres", async () => {
    const t = await criada({ parcelas: 2, descricao: textoDe(150) });
    assert.equal((await parcelamentoDoBanco(t.parcelamentoId))?.descricao, textoDe(100));
  });

  test("a mesma transação serve no máximo 24 parcelas", async () => {
    assert.equal((await criar({ parcelas: 24 })).status, 201);
  });

  test("cartão de outro usuário ou inexistente: 404 CARD_NOT_FOUND e nada é salvo (nem transação nem parcelamento)", async () => {
    const doBeto = await criarCartao("do Beto", BETO);
    for (const cartaoId of [doBeto.id, ID_INEXISTENTE]) {
      for (const extra of [{}, { parcelas: 3 }]) {
        const resposta = await criar({ cartaoId, ...extra });
        assert.equal(resposta.status, 404);
        assert.equal((await json(resposta)).error.code, "CARD_NOT_FOUND");
      }
    }
    assert.equal(await TransactionModel.countDocuments(), 0);
    assert.equal(await CardInstallmentModel.countDocuments(), 0);
  });

  const invalidos: { nome: string; corpo: Record<string, unknown>; campo: string }[] = [
    { nome: "cartão com débito", corpo: { formaPagamento: "debito", cartaoId: "a".repeat(24) }, campo: "cartaoId" },
    { nome: "cartão sem forma de pagamento (padrão 'outro')", corpo: { formaPagamento: undefined, cartaoId: "a".repeat(24) }, campo: "cartaoId" },
    { nome: "parcelas com pix", corpo: { formaPagamento: "pix", parcelas: 3 }, campo: "parcelas" },
    { nome: "parcelas 0", corpo: { parcelas: 0 }, campo: "parcelas" },
    { nome: "25 parcelas", corpo: { parcelas: 25 }, campo: "parcelas" },
    { nome: "parcelas fracionadas", corpo: { parcelas: 2.5 }, campo: "parcelas" },
    { nome: "parcelas como texto", corpo: { parcelas: "3" }, campo: "parcelas" },
    { nome: "receita parcelada", corpo: { tipo: "receita", parcelas: 2 }, campo: "parcelas" },
    { nome: "transação importada parcelada", corpo: { origem: "pluggy", parcelas: 2 }, campo: "parcelas" },
    { nome: "cartaoId mal formado", corpo: { cartaoId: "abc" }, campo: "cartaoId" },
  ];
  for (const { nome, corpo, campo } of invalidos) {
    test(`validação: ${nome} (400 VALIDATION_ERROR, nada salvo)`, async () => {
      const resposta = await criar(corpo);
      const erro = (await json(resposta)).error;
      assert.equal(resposta.status, 400);
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.[campo]), `details deve apontar ${campo}`);
      assert.equal(await TransactionModel.countDocuments(), 0);
      assert.equal(await CardInstallmentModel.countDocuments(), 0);
    });
  }

  test("a listagem traz cartaoId, parcelas e parcelamentoId", async () => {
    const cartao = await criarCartao("Nubank");
    const t = await criada({ cartaoId: cartao.id, parcelas: 4 });
    const { itens } = await json(await tx("GET", ""));
    assert.deepEqual([itens[0].cartaoId, itens[0].parcelas, itens[0].parcelamentoId], [cartao.id, 4, t.parcelamentoId]);
  });
});

// ------------------------------------------------------------------------------------------------ fatura sem dupla contagem

describe("a fatura conta a compra à vista OU as parcelas, nunca as duas", () => {
  test("compra parcelada: entram as parcelas, a compra não entra como à vista", async () => {
    const cartao = await criarCartao("Nubank");
    await criada({ cartaoId: cartao.id, parcelas: 3, data: new Date().toISOString() });

    const [c] = (await json(await inv("GET", "/cards"))).cartoes;
    assert.equal(c.fatura.comprasNoCredito, 0, "a compra parcelada não conta como à vista");
    assert.equal(c.fatura.parcelasDoMes, 300);
    assert.equal(c.fatura.valor, 300, "e não 1200 (900 + 300)");
    assert.equal(c.saldoDevedor, 900);
    assert.equal(c.limiteDisponivel, 5000 - 900, "o limite também não desconta duas vezes");
  });

  test("a mesma compra à vista entra inteira na fatura do mês", async () => {
    const cartao = await criarCartao("Nubank");
    await criada({ cartaoId: cartao.id, data: new Date().toISOString() });

    const [c] = (await json(await inv("GET", "/cards"))).cartoes;
    assert.equal(c.fatura.comprasNoCredito, 900);
    assert.equal(c.fatura.parcelasDoMes, 0);
    assert.equal(c.fatura.valor, 900);
    assert.equal(c.limiteDisponivel, 4100);
  });

  test("à vista e parcelada no mesmo cartão: cada uma conta uma vez só (e outro cartão não é afetado)", async () => {
    const a = await criarCartao("A");
    const b = await criarCartao("B");
    const agora = new Date().toISOString();
    await criada({ cartaoId: a.id, valor: 100, data: agora });
    await criada({ cartaoId: a.id, valor: 600, parcelas: 6, data: agora });
    await criada({ cartaoId: b.id, valor: 40, data: agora });

    const [ca, cb] = (await json(await inv("GET", "/cards"))).cartoes;
    assert.equal(ca.fatura.comprasNoCredito, 100);
    assert.equal(ca.fatura.parcelasDoMes, 100);
    assert.equal(ca.fatura.valor, 200);
    assert.equal(ca.limiteDisponivel, 5000 - 100 - 600);
    assert.equal(cb.fatura.valor, 40);
  });

  test("compra no crédito sem cartão conta para o cartão mais antigo", async () => {
    await criarCartao("A");
    await criarCartao("B");
    await criada({ valor: 70, data: new Date().toISOString() });
    const [ca, cb] = (await json(await inv("GET", "/cards"))).cartoes;
    assert.equal(ca.fatura.comprasNoCredito, 70);
    assert.equal(cb.fatura.comprasNoCredito, 0);
  });

  test("transação importada da Pluggy no crédito (sem cartaoId) conta para o cartão mais antigo", async () => {
    await criarCartao("A");
    await inserir("ana", { tipo: "despesa", valor: 55, formaPagamento: "credito", origem: "pluggy", data: new Date(), externalId: "pl-1" });
    const [ca] = (await json(await inv("GET", "/cards"))).cartoes;
    assert.equal(ca.fatura.comprasNoCredito, 55);
  });

  test("o parcelamento de uma compra aparece com transacaoId e não pode ser excluído por /card/installments", async () => {
    const t = await criada({ parcelas: 3 });
    const { parcelamentos } = await json(await inv("GET", "/card/installments"));
    assert.equal(parcelamentos[0].id, t.parcelamentoId);
    assert.equal(parcelamentos[0].transacaoId, t.id);

    const resposta = await inv("DELETE", `/card/installments/${t.parcelamentoId}`);
    assert.equal(resposta.status, 409);
    assert.equal((await json(resposta)).error.code, "INSTALLMENT_FROM_TRANSACTION");
    assert.ok(await parcelamentoDoBanco(t.parcelamentoId));
  });
});

// ------------------------------------------------------------------------------------------------ excluir

describe("POST /v1/transactions/bulk-delete: compras parceladas", () => {
  test("excluir a transação exclui o parcelamento ligado e a fatura volta ao que era", async () => {
    const t = await criada({ parcelas: 3 });
    const resposta = await excluir([t.id]);
    assert.deepEqual(await json(resposta), { afetadas: 1, naoEncontradas: [] });
    assert.equal(await parcelamentoDoBanco(t.parcelamentoId), null);
    assert.equal((await json(await inv("GET", "/cards"))).cartoes[0].fatura.valor, 0);
  });

  test("só exclui o parcelamento das transações excluídas (e das do usuário)", async () => {
    const a = await criada({ parcelas: 2 });
    const b = await criada({ parcelas: 4 });
    const doBeto = await criada({ parcelas: 2 }, BETO);

    const resposta = await excluir([a.id, doBeto.id]);
    assert.deepEqual(await json(resposta), { afetadas: 1, naoEncontradas: [doBeto.id] });
    assert.equal(await parcelamentoDoBanco(a.parcelamentoId), null);
    assert.ok(await parcelamentoDoBanco(b.parcelamentoId));
    assert.ok(await parcelamentoDoBanco(doBeto.parcelamentoId), "o parcelamento do Beto não foi tocado");
    assert.ok(await doBanco(doBeto.id));
  });

  test("excluir compra à vista no crédito não mexe nos parcelamentos", async () => {
    const parcelada = await criada({ parcelas: 2 });
    const avista = await criada();
    await excluir([avista.id]);
    assert.ok(await parcelamentoDoBanco(parcelada.parcelamentoId));
  });
});

// ------------------------------------------------------------------------------------------------ editar em lote

describe("PATCH /v1/transactions/bulk: cartão e parcelas", () => {
  test("trocar o cartão de uma compra à vista", async () => {
    const a = await criarCartao("A");
    const b = await criarCartao("B");
    const t = await criada({ cartaoId: a.id });
    assert.equal((await editar(t.id, { cartaoId: b.id })).status, 200);
    assert.equal((await doBanco(t.id))?.cartaoId, b.id);
  });

  test("cartaoId null desvincula o cartão", async () => {
    const a = await criarCartao("A");
    const t = await criada({ cartaoId: a.id });
    await editar(t.id, { cartaoId: null });
    assert.equal((await doBanco(t.id))?.cartaoId, undefined);
  });

  test("à vista -> parcelada: cria o parcelamento e liga a transação", async () => {
    const a = await criarCartao("A");
    const t = await criada({ cartaoId: a.id });
    await editar(t.id, { parcelas: 5 });

    const depois = await doBanco(t.id);
    assert.equal(depois?.parcelas, 5);
    assert.ok(depois?.parcelamentoId);
    const p = await parcelamentoDoBanco(depois!.parcelamentoId!);
    assert.deepEqual([p?.valorTotal, p?.parcelas, p?.parcelasPagas, p?.cartaoId, p?.descricao], [900, 5, 0, a.id, "Notebook"]);
  });

  test("parcelada: mudar o valor, as parcelas e a descrição atualiza o MESMO parcelamento", async () => {
    const t = await criada({ parcelas: 3 });
    await editar(t.id, { valor: 1200, parcelas: 6, descricao: "Notebook novo" });

    const p = await parcelamentoDoBanco(t.parcelamentoId);
    assert.deepEqual([p?.valorTotal, p?.parcelas, p?.descricao], [1200, 6, "Notebook novo"]);
    assert.equal(await CardInstallmentModel.countDocuments(), 1);
    assert.equal((await doBanco(t.id))?.parcelamentoId, t.parcelamentoId);
  });

  test("parcelada: trocar o cartão move o parcelamento para o cartão novo", async () => {
    const a = await criarCartao("A");
    const b = await criarCartao("B");
    const t = await criada({ cartaoId: a.id, parcelas: 3 });
    await editar(t.id, { cartaoId: b.id });
    assert.equal((await parcelamentoDoBanco(t.parcelamentoId))?.cartaoId, b.id);
    assert.equal((await doBanco(t.id))?.cartaoId, b.id);
  });

  test("parcelada -> à vista (parcelas 1): remove o parcelamento e a transação vira compra comum", async () => {
    const t = await criada({ parcelas: 3 });
    await editar(t.id, { parcelas: 1 });
    assert.equal(await parcelamentoDoBanco(t.parcelamentoId), null);
    const depois = await doBanco(t.id);
    assert.equal(depois?.parcelas, 1);
    assert.equal(depois?.parcelamentoId, undefined);
  });

  test("parcelada -> outra forma de pagamento: remove o parcelamento e apaga cartão, parcelas e vínculo", async () => {
    const a = await criarCartao("A");
    const t = await criada({ cartaoId: a.id, parcelas: 3 });
    await editar(t.id, { formaPagamento: "pix" });
    assert.equal(await parcelamentoDoBanco(t.parcelamentoId), null);
    const depois = await doBanco(t.id);
    assert.deepEqual([depois?.cartaoId, depois?.parcelas, depois?.parcelamentoId], [undefined, undefined, undefined]);
    assert.equal(depois?.formaPagamento, "pix");
  });

  test("outra forma -> crédito com cartão e parcelas na mesma edição", async () => {
    const a = await criarCartao("A");
    const t = await criada({ formaPagamento: "pix" });
    assert.equal((await editar(t.id, { formaPagamento: "credito", cartaoId: a.id, parcelas: 2 })).status, 200);
    const depois = await doBanco(t.id);
    assert.deepEqual([depois?.formaPagamento, depois?.cartaoId, depois?.parcelas], ["credito", a.id, 2]);
    assert.ok(await parcelamentoDoBanco(depois!.parcelamentoId!));
  });

  test("parcelada que vira receita: o parcelamento é removido", async () => {
    const t = await criada({ parcelas: 3 });
    await editar(t.id, { tipo: "receita" });
    assert.equal(await parcelamentoDoBanco(t.parcelamentoId), null);
    assert.equal((await doBanco(t.id))?.parcelas, 1);
  });

  test("com parcelas já pagas: valor, número de parcelas e remoção são recusados (409 INSTALLMENT_IN_PROGRESS) e nada muda", async () => {
    const t = await criada({ parcelas: 3 });
    await CardInstallmentModel.updateOne({ _id: t.parcelamentoId }, { $set: { parcelasPagas: 1 } });
    const outra = await criada({ descricao: "Outra", valor: 10 });

    for (const alteracoes of [{ valor: 1000 }, { parcelas: 6 }, { parcelas: 1 }, { formaPagamento: "pix" }, { tipo: "receita" }]) {
      // a outra transação do lote também não pode ser alterada: o lote é recusado antes de gravar
      const resposta = await tx("PATCH", "/bulk", { itens: [{ id: outra.id, alteracoes: { valor: 11 } }, { id: t.id, alteracoes }] });
      assert.equal(resposta.status, 409, JSON.stringify(alteracoes));
      assert.equal((await json(resposta)).error.code, "INSTALLMENT_IN_PROGRESS");
    }
    assert.equal((await doBanco(outra.id))?.valor, 10);
    const depois = await doBanco(t.id);
    assert.deepEqual([depois?.valor, depois?.parcelas, depois?.formaPagamento], [900, 3, "credito"]);
    const p = await parcelamentoDoBanco(t.parcelamentoId);
    assert.deepEqual([p?.valorTotal, p?.parcelas, p?.parcelasPagas], [900, 3, 1]);
  });

  test("com parcelas já pagas: trocar o cartão e a descrição continua valendo", async () => {
    const a = await criarCartao("A");
    const b = await criarCartao("B");
    const t = await criada({ cartaoId: a.id, parcelas: 3 });
    await CardInstallmentModel.updateOne({ _id: t.parcelamentoId }, { $set: { parcelasPagas: 2 } });

    assert.equal((await editar(t.id, { cartaoId: b.id, descricao: "Notebook (renomeado)" })).status, 200);
    const p = await parcelamentoDoBanco(t.parcelamentoId);
    assert.deepEqual([p?.cartaoId, p?.descricao, p?.parcelasPagas], [b.id, "Notebook (renomeado)", 2]);
  });

  test("editar só a categoria ou a data de uma parcelada não mexe no parcelamento", async () => {
    const t = await criada({ parcelas: 3 });
    const antes = await parcelamentoDoBanco(t.parcelamentoId);
    await editar(t.id, { categoria: "Educacao", data: "2026-01-01T00:00:00.000Z" });
    const depois = await parcelamentoDoBanco(t.parcelamentoId);
    assert.deepEqual(depois, antes);
    assert.equal((await doBanco(t.id))?.parcelamentoId, t.parcelamentoId);
  });

  test("cartão de outro usuário ou inexistente: 404 CARD_NOT_FOUND e o lote inteiro é recusado", async () => {
    const doBeto = await criarCartao("do Beto", BETO);
    const t = await criada();
    const outra = await criada({ descricao: "Outra" });
    for (const cartaoId of [doBeto.id, ID_INEXISTENTE]) {
      const resposta = await tx("PATCH", "/bulk", {
        itens: [{ id: outra.id, alteracoes: { valor: 5 } }, { id: t.id, alteracoes: { cartaoId } }],
      });
      assert.equal(resposta.status, 404);
      assert.equal((await json(resposta)).error.code, "CARD_NOT_FOUND");
    }
    assert.equal((await doBanco(outra.id))?.valor, 900);
    assert.equal((await doBanco(t.id))?.cartaoId, undefined);
  });

  test("cartão e parcelas só valem no crédito: com a forma final diferente, 400 e nada é gravado", async () => {
    const a = await criarCartao("A");
    const debito = await criada({ formaPagamento: "debito" });
    const credito = await criada();
    const casos: [string, Record<string, unknown>][] = [
      [debito.id, { cartaoId: a.id }],
      [debito.id, { parcelas: 3 }],
      [credito.id, { formaPagamento: "pix", cartaoId: a.id }],
      [credito.id, { formaPagamento: "boleto", parcelas: 2 }],
    ];
    for (const [id, alteracoes] of casos) {
      const resposta = await editar(id, alteracoes);
      assert.equal(resposta.status, 400, JSON.stringify(alteracoes));
      assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    }
    assert.equal(await CardInstallmentModel.countDocuments(), 0);
    assert.equal((await doBanco(credito.id))?.formaPagamento, "credito");
  });

  test("receita e transação importada não podem ser parceladas (400)", async () => {
    const receita = await criada({ tipo: "receita" });
    const importada = await inserir("ana", { tipo: "despesa", valor: 10, formaPagamento: "credito", origem: "pluggy", externalId: "pl-2" });
    assert.equal((await editar(receita.id, { parcelas: 2 })).status, 400);
    assert.equal((await editar(importada, { parcelas: 2 })).status, 400);
    assert.equal(await CardInstallmentModel.countDocuments(), 0);
  });

  const invalidos: [string, Record<string, unknown>][] = [
    ["parcelas 0", { parcelas: 0 }],
    ["parcelas 25", { parcelas: 25 }],
    ["parcelas fracionadas", { parcelas: 1.5 }],
    ["cartaoId mal formado", { cartaoId: "abc" }],
  ];
  for (const [nome, alteracoes] of invalidos) {
    test(`validação: ${nome} (400)`, async () => {
      const t = await criada();
      assert.equal((await editar(t.id, alteracoes)).status, 400);
    });
  }

  test("a edição de transação de outro usuário continua 'não encontrada' (e não mexe nos parcelamentos dele)", async () => {
    const doBeto = await criada({ parcelas: 3 }, BETO);
    const resposta = await editar(doBeto.id, { parcelas: 1 }, ANA);
    assert.deepEqual(await json(resposta), { afetadas: 0, naoEncontradas: [doBeto.id] });
    assert.ok(await parcelamentoDoBanco(doBeto.parcelamentoId));
    assert.equal((await doBanco(doBeto.id))?.parcelas, 3);
  });
});

// ------------------------------------------------------------------------------------------------ duplicar

describe("POST /v1/transactions/:id/duplicate: cartão e parcelas", () => {
  test("copia o cartão e as parcelas e cria um parcelamento NOVO (o do original continua)", async () => {
    const a = await criarCartao("A");
    const original = await criada({ cartaoId: a.id, parcelas: 4 });
    const resposta = await tx("POST", `/${original.id}/duplicate`, { data: "2026-11-01T00:00:00.000Z" });
    const copia = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.equal(copia.cartaoId, a.id);
    assert.equal(copia.parcelas, 4);
    assert.notEqual(copia.parcelamentoId, original.parcelamentoId);
    assert.equal(await CardInstallmentModel.countDocuments(), 2);
    const p = await parcelamentoDoBanco(copia.parcelamentoId);
    assert.deepEqual([p?.valorTotal, p?.parcelas, p?.parcelasPagas, p?.cartaoId], [900, 4, 0, a.id]);
    assert.ok(await parcelamentoDoBanco(original.parcelamentoId));
  });

  test("compra à vista no crédito: copia só o cartão e não cria parcelamento", async () => {
    const a = await criarCartao("A");
    const original = await criada({ cartaoId: a.id });
    const copia = await json(await tx("POST", `/${original.id}/duplicate`));
    assert.equal(copia.cartaoId, a.id);
    assert.equal(copia.parcelas, 1);
    assert.equal(copia.parcelamentoId, undefined);
    assert.equal(await CardInstallmentModel.countDocuments(), 0);
  });

  test("outras formas de pagamento duplicam como antes (sem cartão nem parcelas)", async () => {
    const original = await criada({ formaPagamento: "pix" });
    const copia = await json(await tx("POST", `/${original.id}/duplicate`));
    assert.equal(copia.formaPagamento, "pix");
    assert.equal(copia.cartaoId, undefined);
    assert.equal(copia.parcelas, undefined);
  });

  test("excluir a cópia exclui só o parcelamento dela", async () => {
    const original = await criada({ parcelas: 3 });
    const copia = await json(await tx("POST", `/${original.id}/duplicate`));
    await excluir([copia.id]);
    assert.equal(await parcelamentoDoBanco(copia.parcelamentoId), null);
    assert.ok(await parcelamentoDoBanco(original.parcelamentoId));
  });
});
