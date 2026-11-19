// src/modules/investments/__tests__/investments.routes.test.ts
// /v1/investments de ponta a ponta no Backend (issues #54, #55, #64, #65, #75, #76, #77, #90, #66): portfólio e patrimônio
// simulados, cartão (fatura com as transações REAIS no crédito, limite e vencimento) e parcelamentos. O Servidor Java é
// simulado aqui; a conta de verdade dele tem testes próprios e o teste de integração (grupo5.integracao.test.ts).
import { ANA, BETO, ID_INEXISTENTE, diasAtras, inicioDoDiaUtc, inserir, json, prepararApi, simularServidorGrupo5, textoDe } from "../../goals/__tests__/apoio";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CardInstallmentModel, CardModel, InvestmentModel } from "../investments.model";

const { chamar } = prepararApi();

// `null` = chamada sem login (um parâmetro padrão trocaria o undefined pelo token da Ana)
const api = (metodo: string, caminho: string, corpo?: unknown, token: string | null = ANA) =>
  chamar(metodo, `/investments${caminho}`, token ?? undefined, corpo);

// A data de `n` meses atrás no mesmo dia (limitado ao dia 28, que existe em todo mês): exatamente `n` meses completos.
function mesesAtras(n: number): Date {
  const h = inicioDoDiaUtc();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - n, Math.min(h.getUTCDate(), 28)));
}

const CDB = () => ({ nome: "CDB Banco X", tipo: "renda_fixa", valorInvestido: 1000, taxaMensal: 1, dataAplicacao: mesesAtras(12).toISOString() });
const criarAtivo = async (corpo: Record<string, unknown> = CDB(), token: string | null = ANA) => json(await api("POST", "", corpo, token));
const PARCELAMENTO = { descricao: "Notebook", valorTotal: 1000, parcelas: 10, parcelasPagas: 4, taxaJurosMensal: 2 };
const criarParcelamento = async (corpo: Record<string, unknown> = PARCELAMENTO, token: string | null = ANA) =>
  json(await api("POST", "/card/installments", corpo, token));

// ------------------------------------------------------------------------------------------------ portfólio

describe("GET /v1/investments: portfólio e patrimônio", () => {
  test("sem ativos: lista vazia e tudo zerado", async () => {
    simularServidorGrupo5();
    const resposta = await api("GET", "");
    assert.equal(resposta.status, 200);
    assert.deepEqual(await json(resposta), { ativos: [], totalInvestido: 0, patrimonio: 0, rendimento: 0, rentabilidade: 0 });
  });

  test("lista os ativos com valor atual, rendimento, rentabilidade e percentual da carteira", async () => {
    simularServidorGrupo5();
    await criarAtivo({ ...CDB(), nome: "A" });
    await criarAtivo({ nome: "B", tipo: "fundo", valorInvestido: 2000, taxaMensal: 0.5, dataAplicacao: mesesAtras(6).toISOString() });
    const carteira = await json(await api("GET", ""));

    assert.deepEqual(carteira.ativos.map((a: any) => a.nome), ["A", "B"], "na ordem do cadastro");
    assert.equal(carteira.ativos[0].valorAtual, 1126.83);
    assert.equal(carteira.ativos[1].valorAtual, 2060.76);
    assert.equal(carteira.ativos[0].percentualCarteira, 35.35);
    assert.equal(carteira.ativos[1].percentualCarteira, 64.65);
    assert.equal(carteira.totalInvestido, 3000);
    assert.equal(carteira.patrimonio, 3187.58);
    assert.equal(carteira.rendimento, 187.58);
    assert.equal(carteira.rentabilidade, 6.25);
  });

  test("cada usuário vê só os próprios ativos (e o patrimônio é só dele)", async () => {
    simularServidorGrupo5();
    await criarAtivo({ ...CDB(), nome: "da Ana" }, ANA);
    await criarAtivo({ ...CDB(), nome: "do Beto", valorInvestido: 9000 }, BETO);

    const daAna = await json(await api("GET", "", undefined, ANA));
    assert.deepEqual(daAna.ativos.map((a: any) => a.nome), ["da Ana"]);
    assert.equal(daAna.totalInvestido, 1000);
  });
});

describe("POST /v1/investments: cadastrar ativo", () => {
  test("cria (201) com os meses completos de rendimento e o cálculo do Servidor", async () => {
    const pedidos = simularServidorGrupo5();
    const resposta = await api("POST", "", CDB());
    const ativo = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.match(ativo.id, /^[a-f\d]{24}$/);
    assert.equal(ativo.nome, "CDB Banco X");
    assert.equal(ativo.tipo, "renda_fixa");
    assert.equal(ativo.valorInvestido, 1000);
    assert.equal(ativo.taxaMensal, 1);
    assert.equal(ativo.mesesRendendo, 12);
    assert.equal(ativo.valorAtual, 1126.83);
    assert.equal(ativo.rendimento, 126.83);
    assert.equal(ativo.rentabilidade, 12.68);
    assert.equal(ativo.percentualCarteira, 100, "sozinho na carteira");
    assert.equal(pedidos[0].tipo, "PedidoRentabilidadeSimulada");
    assert.deepEqual(pedidos[0].dados.ativos[0], { id: "novo", nome: "CDB Banco X", tipo: "renda_fixa", valor: 1000, taxaMensal: 1, meses: 12 });
  });

  test("o percentual do ativo novo já é o real, com os que existiam na carteira", async () => {
    simularServidorGrupo5();
    await criarAtivo({ nome: "primeiro", valorInvestido: 1000, taxaMensal: 0 });
    const segundo = await criarAtivo({ nome: "segundo", valorInvestido: 3000, taxaMensal: 0 });
    assert.equal(segundo.percentualCarteira, 75);

    const carteira = await json(await api("GET", ""));
    assert.deepEqual(carteira.ativos.map((a: any) => a.percentualCarteira), [25, 75]);
  });

  test("sem tipo, taxa e data: tipo 'outro', taxa 0 e aplicação de hoje (0 meses, sem rendimento)", async () => {
    simularServidorGrupo5();
    const ativo = await criarAtivo({ nome: "Caixinha", valorInvestido: 500 });

    assert.equal(ativo.tipo, "outro");
    assert.equal(ativo.taxaMensal, 0);
    assert.equal(ativo.dataAplicacao, inicioDoDiaUtc().toISOString());
    assert.equal(ativo.mesesRendendo, 0);
    assert.equal(ativo.valorAtual, 500);
  });

  test("aplicação com data no futuro ainda não rende", async () => {
    simularServidorGrupo5();
    const futuro = new Date(inicioDoDiaUtc().getTime() + 40 * 86_400_000).toISOString();
    assert.equal((await criarAtivo({ ...CDB(), dataAplicacao: futuro })).mesesRendendo, 0);
  });

  test("taxa negativa reduz o valor (renda variável pode perder)", async () => {
    simularServidorGrupo5();
    const ativo = await criarAtivo({ nome: "Ação", tipo: "renda_variavel", valorInvestido: 1000, taxaMensal: -2, dataAplicacao: mesesAtras(1).toISOString() });
    assert.equal(ativo.valorAtual, 980);
    assert.equal(ativo.rentabilidade, -2);
  });

  test("grava para o usuário do token (o dono nunca vem do corpo)", async () => {
    simularServidorGrupo5();
    await criarAtivo({ ...CDB(), userId: "beto" });
    assert.equal((await InvestmentModel.findOne().lean())?.userId, "ana");
  });

  test("Servidor Java fora do ar: 503 e nada é salvo", async () => {
    simularServidorGrupo5({ indisponivel: true });
    const resposta = await api("POST", "", CDB());
    assert.equal(resposta.status, 503);
    assert.equal(await InvestmentModel.countDocuments(), 0);
  });

  const invalidos: { nome: string; corpo: Record<string, unknown>; campo: string }[] = [
    { nome: "sem nome", corpo: { ...CDB(), nome: undefined }, campo: "nome" },
    { nome: "nome só com espaços", corpo: { ...CDB(), nome: "  " }, campo: "nome" },
    { nome: "nome com 101 caracteres", corpo: { ...CDB(), nome: textoDe(101) }, campo: "nome" },
    { nome: "tipo desconhecido", corpo: { ...CDB(), tipo: "poupanca_do_vizinho" }, campo: "tipo" },
    { nome: "valor investido zero", corpo: { ...CDB(), valorInvestido: 0 }, campo: "valorInvestido" },
    { nome: "valor investido negativo", corpo: { ...CDB(), valorInvestido: -10 }, campo: "valorInvestido" },
    { nome: "valor investido como texto", corpo: { ...CDB(), valorInvestido: "1000" }, campo: "valorInvestido" },
    { nome: "taxa de -100% (zeraria o ativo)", corpo: { ...CDB(), taxaMensal: -100 }, campo: "taxaMensal" },
    { nome: "taxa acima de 100%", corpo: { ...CDB(), taxaMensal: 101 }, campo: "taxaMensal" },
    { nome: "taxa como texto", corpo: { ...CDB(), taxaMensal: "1" }, campo: "taxaMensal" },
    { nome: "data de aplicação inválida", corpo: { ...CDB(), dataAplicacao: "ontem" }, campo: "dataAplicacao" },
  ];
  for (const { nome, corpo, campo } of invalidos) {
    test(`validação: ${nome} (400 VALIDATION_ERROR, nada salvo)`, async () => {
      simularServidorGrupo5();
      const resposta = await api("POST", "", corpo);
      const erro = (await json(resposta)).error;
      assert.equal(resposta.status, 400);
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.[campo]), `details deve apontar ${campo}`);
      assert.equal(await InvestmentModel.countDocuments(), 0);
    });
  }
});

describe("DELETE /v1/investments/:id", () => {
  test("exclui (204) e o ativo some do patrimônio", async () => {
    simularServidorGrupo5();
    const ativo = await criarAtivo();
    assert.equal((await api("DELETE", `/${ativo.id}`)).status, 204);
    assert.equal((await json(await api("GET", ""))).patrimonio, 0);
  });

  test("ativo de outro usuário, inexistente ou já excluído: 404 INVESTMENT_NOT_FOUND", async () => {
    simularServidorGrupo5();
    const doBeto = await criarAtivo(CDB(), BETO);
    const proprio = await criarAtivo();
    await api("DELETE", `/${proprio.id}`);

    for (const id of [doBeto.id, ID_INEXISTENTE, proprio.id]) {
      const resposta = await api("DELETE", `/${id}`);
      assert.equal(resposta.status, 404, id);
      assert.equal((await json(resposta)).error.code, "INVESTMENT_NOT_FOUND");
    }
    assert.equal(await InvestmentModel.countDocuments({ userId: "beto" }), 1, "o ativo do Beto continua");
  });

  test("id mal formado: 400", async () => {
    assert.equal((await api("DELETE", "/abc")).status, 400);
  });
});

// ------------------------------------------------------------------------------------------------ cartão

describe("GET e PATCH /v1/investments/card: cartão, limite e fatura", () => {
  test("primeira leitura cria o cartão com os valores padrão (limite 5000, vence dia 10), uma vez só", async () => {
    simularServidorGrupo5();
    const cartao = await json(await api("GET", "/card"));
    await api("GET", "/card");

    assert.equal(cartao.limite, 5000);
    assert.equal(cartao.diaVencimento, 10);
    assert.equal(cartao.limiteDisponivel, 5000);
    assert.equal(cartao.fatura.valor, 0);
    assert.equal(cartao.fatura.comprasNoCredito, 0);
    assert.equal(cartao.fatura.parcelasDoMes, 0);
    assert.equal(await CardModel.countDocuments(), 1);
  });

  test("a fatura é o mês corrente e o vencimento é o próximo dia 10 (deste mês, ou do seguinte se já passou)", async () => {
    simularServidorGrupo5();
    const { fatura } = await json(await api("GET", "/card"));
    const h = inicioDoDiaUtc();
    const esperado = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCDate() <= 10 ? h.getUTCMonth() : h.getUTCMonth() + 1, 10));

    assert.equal(fatura.mes, h.toISOString().slice(0, 7));
    assert.equal(fatura.vencimento, esperado.toISOString().slice(0, 10));
    assert.equal(fatura.diasParaVencer, Math.round((esperado.getTime() - h.getTime()) / 86_400_000));
    assert.ok(fatura.diasParaVencer >= 0 && fatura.diasParaVencer <= 31);
  });

  test("a fatura soma as despesas REAIS no crédito deste mês (e só elas)", async () => {
    simularServidorGrupo5();
    const agora = new Date();
    await inserir("ana", { tipo: "despesa", valor: 300, formaPagamento: "credito", data: agora });
    await inserir("ana", { tipo: "despesa", valor: 200, formaPagamento: "credito", data: inicioDoDiaUtc(agora) });
    await inserir("ana", { tipo: "despesa", valor: 999, formaPagamento: "debito", data: agora });
    await inserir("ana", { tipo: "receita", valor: 777, formaPagamento: "credito", data: agora });
    await inserir("ana", { tipo: "despesa", valor: 555, formaPagamento: "credito", data: diasAtras(45) });
    await inserir("beto", { tipo: "despesa", valor: 444, formaPagamento: "credito", data: agora });

    const cartao = await json(await api("GET", "/card"));
    assert.equal(cartao.fatura.comprasNoCredito, 500);
    assert.equal(cartao.fatura.valor, 500);
    assert.equal(cartao.limiteDisponivel, 4500);
  });

  test("as parcelas do mês entram na fatura e o saldo devedor reduz o limite disponível", async () => {
    simularServidorGrupo5();
    await inserir("ana", { tipo: "despesa", valor: 250, formaPagamento: "credito", data: new Date() });
    await criarParcelamento({ descricao: "Sofá", valorTotal: 1200, parcelas: 12, parcelasPagas: 0, taxaJurosMensal: 0 });

    const cartao = await json(await api("GET", "/card"));
    assert.equal(cartao.fatura.parcelasDoMes, 100);
    assert.equal(cartao.fatura.valor, 350);
    assert.equal(cartao.limiteDisponivel, 3550, "5000 - 250 de compras - 1200 de saldo devedor");
  });

  test("limite estourado: o disponível fica negativo (a tela mostra o excesso)", async () => {
    simularServidorGrupo5();
    await inserir("ana", { tipo: "despesa", valor: 6000, formaPagamento: "credito", data: new Date() });
    assert.equal((await json(await api("GET", "/card"))).limiteDisponivel, -1000);
  });

  test("PATCH muda o limite e o dia de vencimento", async () => {
    simularServidorGrupo5();
    const cartao = await json(await api("PATCH", "/card", { limite: 8000, diaVencimento: 25 }));
    assert.equal(cartao.limite, 8000);
    assert.equal(cartao.diaVencimento, 25);
    assert.equal(cartao.limiteDisponivel, 8000);
    assert.match(cartao.fatura.vencimento, /^\d{4}-\d{2}-25$/);
  });

  test("PATCH antes de qualquer leitura cria o cartão e altera só o que veio (o resto fica no padrão)", async () => {
    simularServidorGrupo5();
    const cartao = await json(await api("PATCH", "/card", { limite: 2000 }));
    assert.equal(cartao.limite, 2000);
    assert.equal(cartao.diaVencimento, 10);
    assert.equal(await CardModel.countDocuments(), 1);
  });

  test("cada usuário tem o próprio cartão", async () => {
    simularServidorGrupo5();
    await api("PATCH", "/card", { limite: 9000 }, ANA);
    assert.equal((await json(await api("GET", "/card", undefined, BETO))).limite, 5000);
  });

  const invalidos: [string, Record<string, unknown>][] = [
    ["corpo vazio", {}],
    ["só campos desconhecidos", { userId: "beto" }],
    ["limite zero", { limite: 0 }],
    ["limite negativo", { limite: -10 }],
    ["limite como texto", { limite: "1000" }],
    ["dia 0", { diaVencimento: 0 }],
    ["dia 29 (não existe em todo mês)", { diaVencimento: 29 }],
    ["dia fracionado", { diaVencimento: 1.5 }],
  ];
  for (const [nome, corpo] of invalidos) {
    test(`PATCH inválido: ${nome} (400)`, async () => {
      simularServidorGrupo5();
      assert.equal((await api("PATCH", "/card", corpo)).status, 400);
    });
  }

  test("Servidor Java fora do ar: 503", async () => {
    simularServidorGrupo5({ indisponivel: true });
    const resposta = await api("GET", "/card");
    assert.equal(resposta.status, 503);
    assert.equal((await json(resposta)).error.code, "JAVA_SERVER_UNAVAILABLE");
  });
});

// ------------------------------------------------------------------------------------------------ parcelamentos

describe("/v1/investments/card/installments: parcelamentos ativos", () => {
  test("sem parcelamentos: lista vazia e totais zerados", async () => {
    simularServidorGrupo5();
    assert.deepEqual(await json(await api("GET", "/card/installments")), {
      parcelamentos: [], totalParcelasDoMes: 0, totalSaldoDevedor: 0, totalJuros: 0,
    });
  });

  test("cria (201) com parcela, parcelas restantes, saldo devedor e juros calculados pelo Servidor", async () => {
    const pedidos = simularServidorGrupo5();
    const resposta = await api("POST", "/card/installments", PARCELAMENTO);
    const p = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.match(p.id, /^[a-f\d]{24}$/);
    assert.equal(p.descricao, "Notebook");
    assert.equal(p.valorParcela, 111.33);
    assert.equal(p.parcelasRestantes, 6);
    assert.equal(p.saldoDevedor, 623.59);
    assert.equal(p.jurosTotal, 113.27);
    assert.equal(p.quitado, false);
    assert.equal(pedidos[0].tipo, "PedidoCalcularParcelamentos");
    assert.deepEqual(pedidos[0].dados.parcelamentos[0], { id: "novo", ...PARCELAMENTO });
  });

  test("sem juros e sem parcelas pagas: divide igual e o saldo é o total", async () => {
    simularServidorGrupo5();
    const p = await criarParcelamento({ descricao: "Geladeira", valorTotal: 1200, parcelas: 12 });
    assert.equal(p.parcelasPagas, 0);
    assert.equal(p.taxaJurosMensal, 0);
    assert.equal(p.valorParcela, 100);
    assert.equal(p.saldoDevedor, 1200);
    assert.equal(p.jurosTotal, 0);
  });

  test("a listagem traz os totais só dos parcelamentos ainda ativos (o quitado não conta)", async () => {
    simularServidorGrupo5();
    await criarParcelamento();
    await criarParcelamento({ descricao: "Geladeira", valorTotal: 1200, parcelas: 12, parcelasPagas: 3 });
    await criarParcelamento({ descricao: "Quitado", valorTotal: 600, parcelas: 3, parcelasPagas: 3 });

    const r = await json(await api("GET", "/card/installments"));
    assert.deepEqual(r.parcelamentos.map((p: any) => p.descricao), ["Notebook", "Geladeira", "Quitado"]);
    assert.equal(r.parcelamentos[2].quitado, true);
    assert.equal(r.totalParcelasDoMes, 211.33);
    assert.equal(r.totalSaldoDevedor, 1523.59);
    assert.equal(r.totalJuros, 113.27);
  });

  test("cada usuário vê só os próprios parcelamentos", async () => {
    simularServidorGrupo5();
    await criarParcelamento({ ...PARCELAMENTO, descricao: "da Ana" }, ANA);
    await criarParcelamento({ ...PARCELAMENTO, descricao: "do Beto" }, BETO);
    const daAna = await json(await api("GET", "/card/installments", undefined, ANA));
    assert.deepEqual(daAna.parcelamentos.map((p: any) => p.descricao), ["da Ana"]);
  });

  test("Servidor Java fora do ar: 503 e nada é salvo", async () => {
    simularServidorGrupo5({ indisponivel: true });
    assert.equal((await api("POST", "/card/installments", PARCELAMENTO)).status, 503);
    assert.equal(await CardInstallmentModel.countDocuments(), 0);
  });

  const invalidos: { nome: string; corpo: Record<string, unknown>; campo: string }[] = [
    { nome: "sem descrição", corpo: { ...PARCELAMENTO, descricao: undefined }, campo: "descricao" },
    { nome: "descrição só com espaços", corpo: { ...PARCELAMENTO, descricao: " " }, campo: "descricao" },
    { nome: "valor total zero", corpo: { ...PARCELAMENTO, valorTotal: 0 }, campo: "valorTotal" },
    { nome: "valor total como texto", corpo: { ...PARCELAMENTO, valorTotal: "1000" }, campo: "valorTotal" },
    { nome: "zero parcelas", corpo: { ...PARCELAMENTO, parcelas: 0 }, campo: "parcelas" },
    { nome: "mais de 120 parcelas", corpo: { ...PARCELAMENTO, parcelas: 121 }, campo: "parcelas" },
    { nome: "parcelas fracionadas", corpo: { ...PARCELAMENTO, parcelas: 2.5 }, campo: "parcelas" },
    { nome: "parcelas pagas negativas", corpo: { ...PARCELAMENTO, parcelasPagas: -1 }, campo: "parcelasPagas" },
    { nome: "mais parcelas pagas que parcelas", corpo: { ...PARCELAMENTO, parcelasPagas: 11 }, campo: "parcelasPagas" },
    { nome: "juros negativos", corpo: { ...PARCELAMENTO, taxaJurosMensal: -1 }, campo: "taxaJurosMensal" },
    { nome: "juros acima de 100%", corpo: { ...PARCELAMENTO, taxaJurosMensal: 101 }, campo: "taxaJurosMensal" },
  ];
  for (const { nome, corpo, campo } of invalidos) {
    test(`validação: ${nome} (400 VALIDATION_ERROR, nada salvo)`, async () => {
      simularServidorGrupo5();
      const resposta = await api("POST", "/card/installments", corpo);
      const erro = (await json(resposta)).error;
      assert.equal(resposta.status, 400);
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.[campo]), `details deve apontar ${campo}`);
      assert.equal(await CardInstallmentModel.countDocuments(), 0);
    });
  }

  test("PATCH: pagar uma parcela recalcula o saldo; pagar todas quita", async () => {
    simularServidorGrupo5();
    const p = await criarParcelamento({ descricao: "Sofá", valorTotal: 1200, parcelas: 12, parcelasPagas: 2 });

    const paga = await json(await api("PATCH", `/card/installments/${p.id}`, { parcelasPagas: 3 }));
    assert.equal(paga.parcelasPagas, 3);
    assert.equal(paga.saldoDevedor, 900);
    assert.equal(paga.quitado, false);

    const quitada = await json(await api("PATCH", `/card/installments/${p.id}`, { parcelasPagas: 12 }));
    assert.equal(quitada.quitado, true);
    assert.equal(quitada.saldoDevedor, 0);
    assert.equal((await CardInstallmentModel.findById(p.id).lean())?.parcelasPagas, 12);
  });

  test("PATCH: muda só a descrição", async () => {
    simularServidorGrupo5();
    const p = await criarParcelamento();
    const editado = await json(await api("PATCH", `/card/installments/${p.id}`, { descricao: "MacBook" }));
    assert.equal(editado.descricao, "MacBook");
    assert.equal(editado.parcelasPagas, 4);
  });

  test("PATCH: mais parcelas pagas que o total é recusado e nada muda", async () => {
    simularServidorGrupo5();
    const p = await criarParcelamento();
    const resposta = await api("PATCH", `/card/installments/${p.id}`, { parcelasPagas: 11 });
    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    assert.equal((await CardInstallmentModel.findById(p.id).lean())?.parcelasPagas, 4);
  });

  test("PATCH: corpo vazio, descrição em branco ou parcelas pagas negativas: 400", async () => {
    simularServidorGrupo5();
    const p = await criarParcelamento();
    for (const corpo of [{}, { descricao: " " }, { parcelasPagas: -1 }, { valorTotal: 5 }]) {
      assert.equal((await api("PATCH", `/card/installments/${p.id}`, corpo)).status, 400, JSON.stringify(corpo));
    }
  });

  test("PATCH e DELETE em parcelamento de outro usuário, inexistente ou já excluído: 404 INSTALLMENT_NOT_FOUND", async () => {
    simularServidorGrupo5();
    const doBeto = await criarParcelamento(PARCELAMENTO, BETO);
    const proprio = await criarParcelamento();
    assert.equal((await api("DELETE", `/card/installments/${proprio.id}`)).status, 204);

    for (const id of [doBeto.id, ID_INEXISTENTE, proprio.id]) {
      for (const [metodo, corpo] of [["PATCH", { parcelasPagas: 1 }], ["DELETE", undefined]] as const) {
        const resposta = await api(metodo, `/card/installments/${id}`, corpo);
        assert.equal(resposta.status, 404, `${metodo} ${id}`);
        assert.equal((await json(resposta)).error.code, "INSTALLMENT_NOT_FOUND");
      }
    }
    assert.equal((await CardInstallmentModel.findById(doBeto.id).lean())?.parcelasPagas, 4, "o do Beto não mudou");
  });

  test("DELETE: exclui (204) e o parcelamento sai da fatura", async () => {
    simularServidorGrupo5();
    const p = await criarParcelamento({ descricao: "Sofá", valorTotal: 1200, parcelas: 12 });
    await api("DELETE", `/card/installments/${p.id}`);
    assert.equal((await json(await api("GET", "/card"))).fatura.parcelasDoMes, 0);
  });

  test("id mal formado: 400", async () => {
    assert.equal((await api("DELETE", "/card/installments/abc")).status, 400);
    assert.equal((await api("PATCH", "/card/installments/abc", { parcelasPagas: 1 })).status, 400);
  });
});

// ------------------------------------------------------------------------------------------------ autenticação

describe("autenticação", () => {
  test("sem token: 401 UNAUTHENTICATED em todas as rotas, e nada é criado", async () => {
    const chamadas: [string, string, unknown?][] = [
      ["GET", ""], ["POST", "", CDB()], ["DELETE", `/${ID_INEXISTENTE}`],
      ["GET", "/card"], ["PATCH", "/card", { limite: 1 }],
      ["GET", "/card/installments"], ["POST", "/card/installments", PARCELAMENTO],
      ["PATCH", `/card/installments/${ID_INEXISTENTE}`, { parcelasPagas: 1 }], ["DELETE", `/card/installments/${ID_INEXISTENTE}`],
    ];
    for (const [metodo, caminho, corpo] of chamadas) {
      const resposta = await api(metodo, caminho, corpo, null);
      assert.equal(resposta.status, 401, `${metodo} ${caminho}`);
      assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    }
    assert.equal(await InvestmentModel.countDocuments() + (await CardInstallmentModel.countDocuments()) + (await CardModel.countDocuments()), 0);
  });
});
