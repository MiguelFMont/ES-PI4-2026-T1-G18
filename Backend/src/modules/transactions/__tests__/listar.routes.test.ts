// src/modules/transactions/__tests__/listar.routes.test.ts
// GET /v1/transactions de ponta a ponta no Backend (issue #59): isolamento entre usuários, ordem, paginação, filtros
// (sozinhos e combinados), resumo do extrato e validação dos parâmetros.
import { ANA, BETO, inserir, json, prepararApi, textoDe } from "./apoio";
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { TransactionModel } from "../transactions.model";

const { chamar } = prepararApi();

const listar = (consulta = "", token: string | null = ANA) =>
  chamar("GET", `/transactions${consulta ? `?${consulta}` : ""}`, token ?? undefined);
const descricoes = (resposta: any) => resposta.itens.map((t: any) => t.descricao).sort();

// Seis transações da Ana, espalhadas de propósito: tipos, categorias, formas, origens, valores e datas diferentes,
// inclusive duas bem na virada de mês (30/09 às 23:59:59 e 31/10 às 15:00) para provar o filtro de período.
async function montarCenario() {
  const base = { userId: "ana" } as const;
  await inserir(base.userId, { descricao: "Supermercado Extra", tipo: "despesa", valor: 100, categoria: "Alimentacao", formaPagamento: "pix", data: new Date("2026-10-05T12:00:00Z") });
  await inserir(base.userId, { descricao: "Uber viagem", tipo: "despesa", valor: 50.5, categoria: "Transporte", formaPagamento: "credito", data: new Date("2026-10-10T08:00:00Z") });
  await inserir(base.userId, { descricao: "Salario empresa", tipo: "receita", valor: 3000, categoria: "Salario", formaPagamento: "pix", data: new Date("2026-10-31T15:00:00Z") });
  await inserir(base.userId, { descricao: "Netflix (assinatura)", tipo: "despesa", valor: 29.9, categoria: "Lazer", formaPagamento: "credito", origem: "pluggy", externalId: "ext-1", data: new Date("2026-11-02T00:00:00Z") });
  await inserir(base.userId, { descricao: "Aluguel", tipo: "despesa", valor: 1200, categoria: "Moradia", formaPagamento: "boleto", data: new Date("2026-09-30T23:59:59Z") });
  await inserir(base.userId, { descricao: "Freela", tipo: "receita", valor: 150, categoria: "Outros", formaPagamento: "pix", origem: "pluggy", externalId: "ext-2", data: new Date("2026-10-15T10:00:00Z") });
}

describe("GET /v1/transactions: o que volta", () => {
  test("sem nenhuma transação: lista vazia, totalPaginas 0 e resumo zerado", async () => {
    const resposta = await listar();
    const corpo = await json(resposta);

    assert.equal(resposta.status, 200);
    assert.deepEqual(corpo, {
      itens: [], pagina: 1, limite: 20, total: 0, totalPaginas: 0, resumo: { receitas: 0, despesas: 0, saldo: 0 },
    });
  });

  test("cada item tem só os campos do contrato (sem userId, _id, __v nem datas internas)", async () => {
    await inserir("ana", { observacoes: "anotação" });
    await inserir("ana", { observacoes: undefined, descricao: "Sem observação" });
    const { itens } = await json(await listar());

    for (const item of itens) {
      for (const interno of ["userId", "_id", "__v", "createdAt", "updatedAt", "externalId", "contaConectadaId"]) {
        assert.ok(!(interno in item), `${interno} não pode aparecer`);
      }
      assert.match(item.id, /^[a-f\d]{24}$/);
      assert.match(item.data, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
    assert.equal(itens.find((t: any) => t.descricao === "Supermercado")?.observacoes, "anotação");
    assert.ok(!("observacoes" in itens.find((t: any) => t.descricao === "Sem observação")), "observação só aparece quando existe");
  });

  test("cada usuário vê só as próprias transações (e só elas entram no resumo)", async () => {
    await inserir("ana", { descricao: "da Ana", valor: 10 });
    await inserir("beto", { descricao: "do Beto", valor: 99 });

    const daAna = await json(await listar("", ANA));
    const doBeto = await json(await listar("", BETO));

    assert.deepEqual(descricoes(daAna), ["da Ana"]);
    assert.deepEqual(descricoes(doBeto), ["do Beto"]);
    assert.equal(daAna.total, 1);
    assert.equal(daAna.resumo.despesas, 10);
    assert.equal(doBeto.resumo.despesas, 99);
  });

  test("a mais recente vem primeiro", async () => {
    await montarCenario();
    const { itens } = await json(await listar());
    assert.deepEqual(
      itens.map((t: any) => t.descricao),
      ["Netflix (assinatura)", "Salario empresa", "Freela", "Uber viagem", "Supermercado Extra", "Aluguel"]
    );
  });

  test("na mesma data, a última cadastrada vem primeiro (a ordem é estável)", async () => {
    const mesmaData = new Date("2026-10-05T12:00:00Z");
    await inserir("ana", { descricao: "primeira", data: mesmaData });
    await inserir("ana", { descricao: "segunda", data: mesmaData });
    await inserir("ana", { descricao: "terceira", data: mesmaData });

    const primeira = await json(await listar());
    const segunda = await json(await listar());

    assert.deepEqual(primeira.itens.map((t: any) => t.descricao), ["terceira", "segunda", "primeira"]);
    assert.deepEqual(segunda.itens, primeira.itens);
  });
});

describe("GET /v1/transactions: paginação", () => {
  beforeEach(async () => {
    // 25 transações, uma por dia, da mais antiga (01/10) à mais nova (25/10)
    await TransactionModel.insertMany(
      Array.from({ length: 25 }, (_, i) => ({
        userId: "ana", tipo: "despesa", valor: 1, categoria: "Outros", formaPagamento: "pix", origem: "manual",
        descricao: `item ${String(i + 1).padStart(2, "0")}`, data: new Date(Date.UTC(2026, 9, i + 1, 12)),
      }))
    );
  });

  test("sem parâmetros: página 1, 20 por página", async () => {
    const corpo = await json(await listar());
    assert.equal(corpo.pagina, 1);
    assert.equal(corpo.limite, 20);
    assert.equal(corpo.itens.length, 20);
    assert.equal(corpo.total, 25);
    assert.equal(corpo.totalPaginas, 2);
  });

  test("a última página traz só o que sobra", async () => {
    const corpo = await json(await listar("pagina=3&limite=10"));
    assert.equal(corpo.itens.length, 5);
    assert.equal(corpo.totalPaginas, 3);
    assert.equal(corpo.pagina, 3);
  });

  test("as páginas não repetem nem perdem itens", async () => {
    const vistos: string[] = [];
    for (const pagina of [1, 2, 3]) {
      const corpo = await json(await listar(`pagina=${pagina}&limite=10`));
      vistos.push(...corpo.itens.map((t: any) => t.descricao));
    }
    assert.equal(vistos.length, 25);
    assert.equal(new Set(vistos).size, 25);
    assert.equal(vistos[0], "item 25", "começa pela mais recente");
    assert.equal(vistos[24], "item 01");
  });

  test("página além da última: lista vazia, mas o total continua certo", async () => {
    const corpo = await json(await listar("pagina=9&limite=10"));
    assert.deepEqual(corpo.itens, []);
    assert.equal(corpo.total, 25);
    assert.equal(corpo.totalPaginas, 3);
  });

  test("o limite máximo (100) é aceito", async () => {
    const resposta = await listar("limite=100");
    assert.equal(resposta.status, 200);
    assert.equal((await json(resposta)).itens.length, 25);
  });

  test("o total e o resumo valem para todas as páginas, não só para a que voltou", async () => {
    const corpo = await json(await listar("limite=5"));
    assert.equal(corpo.itens.length, 5);
    assert.equal(corpo.total, 25);
    assert.equal(corpo.resumo.despesas, 25);
  });
});

describe("GET /v1/transactions: filtros", () => {
  beforeEach(montarCenario);

  test("tipo", async () => {
    assert.deepEqual(descricoes(await json(await listar("tipo=receita"))), ["Freela", "Salario empresa"]);
    assert.equal((await json(await listar("tipo=despesa"))).total, 4);
  });

  test("categoria (comparação exata)", async () => {
    assert.deepEqual(descricoes(await json(await listar("categoria=Transporte"))), ["Uber viagem"]);
    assert.equal((await json(await listar("categoria=transporte"))).total, 0, "maiúsculas e minúsculas contam");
  });

  test("forma de pagamento", async () => {
    assert.deepEqual(descricoes(await json(await listar("formaPagamento=boleto"))), ["Aluguel"]);
    assert.equal((await json(await listar("formaPagamento=pix"))).total, 3);
  });

  test("origem: manual e pluggy", async () => {
    assert.deepEqual(descricoes(await json(await listar("origem=pluggy"))), ["Freela", "Netflix (assinatura)"]);
    assert.equal((await json(await listar("origem=manual"))).total, 4);
  });

  test("busca na descrição, sem diferenciar maiúsculas de minúsculas", async () => {
    assert.deepEqual(descricoes(await json(await listar("busca=NETFLIX"))), ["Netflix (assinatura)"]);
    assert.deepEqual(descricoes(await json(await listar("busca=mercado"))), ["Supermercado Extra"]);
  });

  test("o texto da busca é literal: '(' e '.' não são padrões de expressão regular", async () => {
    assert.deepEqual(descricoes(await json(await listar(`busca=${encodeURIComponent("(")}`))), ["Netflix (assinatura)"]);
    assert.equal((await json(await listar(`busca=${encodeURIComponent(".")}`))).total, 0, "'.' não pode valer como curinga");
    assert.equal((await json(await listar(`busca=${encodeURIComponent(".*")}`))).total, 0);
  });

  test("período: dataFim sem horário vale até o fim daquele dia", async () => {
    // 31/10 às 15:00 entra; 30/09 às 23:59:59 e 02/11 ficam de fora
    const corpo = await json(await listar("dataInicio=2026-10-01&dataFim=2026-10-31"));
    assert.deepEqual(descricoes(corpo), ["Freela", "Salario empresa", "Supermercado Extra", "Uber viagem"]);
  });

  test("período: dataFim com horário vale só até aquele instante", async () => {
    const corpo = await json(await listar("dataInicio=2026-10-01&dataFim=2026-10-31T10:00:00Z"));
    assert.ok(!descricoes(corpo).includes("Salario empresa"), "31/10 às 15:00 passou do horário informado");
    assert.equal(corpo.total, 3);
  });

  test("período: o limite inicial é inclusivo", async () => {
    const corpo = await json(await listar("dataInicio=2026-10-05T12:00:00Z&dataFim=2026-10-05T12:00:00Z"));
    assert.deepEqual(descricoes(corpo), ["Supermercado Extra"]);
  });

  test("período: só dataInicio ou só dataFim", async () => {
    assert.deepEqual(descricoes(await json(await listar("dataInicio=2026-11-01"))), ["Netflix (assinatura)"]);
    assert.deepEqual(descricoes(await json(await listar("dataFim=2026-09-30"))), ["Aluguel"]);
  });

  test("faixa de valor: os dois extremos são inclusivos", async () => {
    assert.deepEqual(descricoes(await json(await listar("valorMin=100&valorMax=150"))), ["Freela", "Supermercado Extra"]);
    assert.deepEqual(descricoes(await json(await listar("valorMax=29.9"))), ["Netflix (assinatura)"]);
    assert.deepEqual(descricoes(await json(await listar("valorMin=3000"))), ["Salario empresa"]);
  });

  test("filtros se combinam (e)", async () => {
    const corpo = await json(await listar("tipo=despesa&origem=manual&valorMin=100"));
    assert.deepEqual(descricoes(corpo), ["Aluguel", "Supermercado Extra"]);
  });

  test("filtros que não casam com nada: lista vazia, total 0 e resumo zerado", async () => {
    const corpo = await json(await listar("categoria=Saude"));
    assert.deepEqual(corpo.itens, []);
    assert.equal(corpo.total, 0);
    assert.equal(corpo.totalPaginas, 0);
    assert.deepEqual(corpo.resumo, { receitas: 0, despesas: 0, saldo: 0 });
  });

  test("filtros valem para o usuário do token: nada do Beto aparece", async () => {
    await inserir("beto", { descricao: "do Beto", categoria: "Transporte" });
    assert.deepEqual(descricoes(await json(await listar("categoria=Transporte"))), ["Uber viagem"]);
  });
});

describe("GET /v1/transactions: resumo (entradas, saídas e saldo)", () => {
  test("soma tudo o que passa nos filtros, de todas as páginas", async () => {
    await montarCenario();
    const corpo = await json(await listar("limite=1"));
    // receitas: 3000 + 150; despesas: 100 + 50.5 + 29.9 + 1200
    assert.deepEqual(corpo.resumo, { receitas: 3150, despesas: 1380.4, saldo: 1769.6 });
  });

  test("é recalculado a cada filtro", async () => {
    await montarCenario();
    assert.deepEqual((await json(await listar("tipo=despesa"))).resumo, { receitas: 0, despesas: 1380.4, saldo: -1380.4 });
    assert.deepEqual((await json(await listar("origem=pluggy"))).resumo, { receitas: 150, despesas: 29.9, saldo: 120.1 });
  });

  test("o saldo pode ser negativo", async () => {
    await inserir("ana", { tipo: "receita", valor: 100 });
    await inserir("ana", { tipo: "despesa", valor: 350 });
    assert.equal((await json(await listar())).resumo.saldo, -250);
  });

  test("a soma de decimais é arredondada em 2 casas (sem 0.30000000000000004)", async () => {
    await inserir("ana", { tipo: "receita", valor: 0.1 });
    await inserir("ana", { tipo: "receita", valor: 0.2 });
    await inserir("ana", { tipo: "despesa", valor: 0.7 });
    await inserir("ana", { tipo: "despesa", valor: 0.1 });
    const { resumo } = await json(await listar());
    assert.deepEqual(resumo, { receitas: 0.3, despesas: 0.8, saldo: -0.5 });
  });
});

describe("GET /v1/transactions: parâmetros inválidos (400 VALIDATION_ERROR)", () => {
  const busca101 = textoDe(101);
  const casos: { nome: string; consulta: string; campo: string }[] = [
    { nome: "tipo desconhecido", consulta: "tipo=transferencia", campo: "tipo" },
    { nome: "forma de pagamento desconhecida", consulta: "formaPagamento=cheque", campo: "formaPagamento" },
    { nome: "origem desconhecida", consulta: "origem=robo", campo: "origem" },
    { nome: "busca vazia", consulta: "busca=", campo: "busca" },
    { nome: "busca com mais de 100 caracteres", consulta: `busca=${busca101}`, campo: "busca" },
    { nome: "dataInicio inválida", consulta: "dataInicio=ontem", campo: "dataInicio" },
    { nome: "dataFim inválida", consulta: "dataFim=2026-13-45", campo: "dataFim" },
    { nome: "dataInicio depois de dataFim", consulta: "dataInicio=2026-10-31&dataFim=2026-10-01", campo: "dataInicio" },
    { nome: "valorMin negativo", consulta: "valorMin=-1", campo: "valorMin" },
    { nome: "valorMax que não é número", consulta: "valorMax=abc", campo: "valorMax" },
    { nome: "valorMin maior que valorMax", consulta: "valorMin=10&valorMax=5", campo: "valorMin" },
    { nome: "página 0", consulta: "pagina=0", campo: "pagina" },
    { nome: "página fracionada", consulta: "pagina=1.5", campo: "pagina" },
    { nome: "limite 0", consulta: "limite=0", campo: "limite" },
    { nome: "limite acima de 100", consulta: "limite=101", campo: "limite" },
    { nome: "limite que não é número", consulta: "limite=muitos", campo: "limite" },
  ];

  for (const { nome, consulta, campo } of casos) {
    test(nome, async () => {
      const resposta = await listar(consulta);
      const erro = (await json(resposta)).error;
      assert.equal(resposta.status, 400);
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.[campo]), `details deve apontar o campo ${campo}`);
    });
  }
});

describe("GET /v1/transactions: autenticação", () => {
  test("sem token: 401 UNAUTHENTICATED", async () => {
    await inserir("ana");
    const resposta = await listar("", null);
    assert.equal(resposta.status, 401);
    assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
  });
});
