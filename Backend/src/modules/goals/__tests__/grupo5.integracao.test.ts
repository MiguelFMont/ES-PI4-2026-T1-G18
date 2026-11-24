/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/modules/goals/__tests__/grupo5.integracao.test.ts
// Backend + Servidor Java de VERDADE (Grupo 5): metas, investimentos, parcelamentos e cartão. Prova que o contrato dos
// pedidos (nomes e tipos dos campos) bate dos dois lados. Fica PULADO no `npm test` comum; para rodar, suba o Servidor
// (`mvn exec:java -Dexec.mainClass=com.financeai.Main`, porta opcional como argumento) e rode:
//   JAVA_SERVER_INTEGRACAO=1 JAVA_SERVER_PORT=3000 npm test            (bash)
//   $env:JAVA_SERVER_INTEGRACAO="1"; $env:JAVA_SERVER_PORT="3000"; npm test   (PowerShell)
// Os números esperados são os mesmos dos testes do Servidor (mvn test), calculados por fora do código.
import { ANA, diasAFrente, inicioDoDiaUtc, inserir, json, prepararApi } from "./apoio";
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { javaServerClient } from "../../../java-client/java-server.client";

const integracao = process.env.JAVA_SERVER_INTEGRACAO === "1";
const { chamar } = prepararApi();

// o pool de conexões duradouras com o Java mantém o Node vivo: fecha no fim para o teste terminar
after(() => javaServerClient.fechar());

const api = (metodo: string, caminho: string, corpo?: unknown) => chamar(metodo, caminho, ANA, corpo);

function mesesAtras(n: number): Date {
  const h = inicioDoDiaUtc();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - n, Math.min(h.getUTCDate(), 28)));
}

describe("Backend + Servidor Java real: Grupo 5", { skip: integracao ? false : "defina JAVA_SERVER_INTEGRACAO=1 com o Servidor Java no ar" }, () => {
  test("meta: o Servidor devolve percentual, o que falta, prazo e aporte mensal (PedidoProgressoMeta)", async () => {
    // prazo daqui a 181 dias: 7 meses de 30 dias para guardar o que falta
    const meta = await json(await api("POST", "/goals", { titulo: "Viagem", valorObjetivo: 10000, valorInicial: 5000, prazo: diasAFrente(181).toISOString() }));

    assert.equal(meta.percentual, 50);
    assert.equal(meta.falta, 5000);
    assert.equal(meta.concluida, false);
    assert.equal(meta.noPrazo, true);
    assert.equal(meta.diasRestantes, 181);
    assert.equal(meta.mesesRestantes, 7);
    assert.equal(meta.aporteMensalNecessario, 714.29);
  });

  test("meta: as transações vinculadas à meta entram no progresso (e só elas)", async () => {
    const meta = await json(await api("POST", "/goals", { titulo: "Reserva", valorObjetivo: 10000, valorInicial: 5000, prazo: diasAFrente(181).toISOString() }));
    const hoje = inicioDoDiaUtc().toISOString().slice(0, 10);
    const aporte = { tipo: "despesa", valor: 2500, categoria: "Outros", data: hoje, descricao: "Aporte", formaPagamento: "pix", metaId: meta.id };

    assert.equal((await api("POST", "/transactions", aporte)).status, 201);
    await inserir("ana", { tipo: "receita", valor: 9999, data: inicioDoDiaUtc() }); // sem vínculo: não conta

    const depois = await json(await api("GET", `/goals/${meta.id}`));
    assert.equal(depois.valorAportado, 2500);
    assert.equal(depois.quantidadeAportes, 1);
    assert.equal(depois.valorAtual, 7500);
    assert.equal(depois.percentual, 75);

    // retirada: receita vinculada subtrai; passando de tudo o que havia, o total fica negativo e o percentual, 0
    const retirada = { ...aporte, tipo: "receita", valor: 9000, descricao: "Retirada" };
    assert.equal((await api("POST", "/transactions", retirada)).status, 201);
    const negativa = await json(await api("GET", `/goals/${meta.id}`));
    assert.equal(negativa.valorAportado, -6500);
    assert.equal(negativa.valorAtual, -1500);
    assert.equal(negativa.percentual, 0);
  });

  test("meta atingida: 100%, concluída e sem aporte", async () => {
    const meta = await json(await api("POST", "/goals", { titulo: "Pronta", valorObjetivo: 1000, valorInicial: 1500, prazo: diasAFrente(30).toISOString() }));
    assert.equal(meta.percentual, 100);
    assert.equal(meta.concluida, true);
    assert.equal(meta.aporteMensalNecessario, 0);
  });

  test("investimentos: juros compostos e percentual da carteira (PedidoRentabilidadeSimulada)", async () => {
    await api("POST", "/investments", { nome: "CDB", tipo: "renda_fixa", valorInvestido: 1000, taxaMensal: 1, dataAplicacao: mesesAtras(12).toISOString() });
    await api("POST", "/investments", { nome: "Tesouro", tipo: "renda_fixa", valorInvestido: 2000, taxaMensal: 0.5, dataAplicacao: mesesAtras(6).toISOString() });

    const carteira = await json(await api("GET", "/investments"));
    assert.equal(carteira.ativos[0].valorAtual, 1126.83);
    assert.equal(carteira.ativos[0].mesesRendendo, 12);
    assert.equal(carteira.ativos[1].valorAtual, 2060.76);
    assert.deepEqual(carteira.ativos.map((a: any) => a.percentualCarteira), [35.35, 64.65]);
    assert.equal(carteira.totalInvestido, 3000);
    assert.equal(carteira.patrimonio, 3187.58);
    assert.equal(carteira.rendimento, 187.58);
    assert.equal(carteira.rentabilidade, 6.25);
  });

  test("carteira vazia: o Servidor responde zeros, sem erro", async () => {
    assert.deepEqual(await json(await api("GET", "/investments")), { ativos: [], totalInvestido: 0, patrimonio: 0, rendimento: 0, rentabilidade: 0 });
  });

  test("parcelamentos: tabela Price e saldo devedor (PedidoCalcularParcelamentos)", async () => {
    await api("POST", "/investments/card/installments", { descricao: "Notebook", valorTotal: 1000, parcelas: 10, parcelasPagas: 4, taxaJurosMensal: 2 });
    await api("POST", "/investments/card/installments", { descricao: "Geladeira", valorTotal: 1200, parcelas: 12, parcelasPagas: 3 });
    await api("POST", "/investments/card/installments", { descricao: "Quitado", valorTotal: 600, parcelas: 3, parcelasPagas: 3 });

    const r = await json(await api("GET", "/investments/card/installments"));
    const [notebook, geladeira, quitado] = r.parcelamentos;
    assert.equal(notebook.valorParcela, 111.33);
    assert.equal(notebook.saldoDevedor, 623.59);
    assert.equal(notebook.jurosTotal, 113.27);
    assert.equal(notebook.parcelasRestantes, 6);
    assert.equal(geladeira.valorParcela, 100);
    assert.equal(geladeira.saldoDevedor, 900);
    assert.equal(quitado.quitado, true);
    assert.equal(r.totalParcelasDoMes, 211.33);
    assert.equal(r.totalSaldoDevedor, 1523.59);
    assert.equal(r.totalJuros, 113.27);
  });

  test("cartão: fatura com as compras reais no crédito e as parcelas, limite disponível", async () => {
    await inserir("ana", { tipo: "despesa", valor: 250, formaPagamento: "credito", data: new Date() });
    await api("POST", "/investments/card/installments", { descricao: "Sofá", valorTotal: 1200, parcelas: 12 });

    const cartao = await json(await api("GET", "/investments/card"));
    assert.equal(cartao.fatura.comprasNoCredito, 250);
    assert.equal(cartao.fatura.parcelasDoMes, 100);
    assert.equal(cartao.fatura.valor, 350);
    assert.equal(cartao.limiteDisponivel, 3550);
  });
});
