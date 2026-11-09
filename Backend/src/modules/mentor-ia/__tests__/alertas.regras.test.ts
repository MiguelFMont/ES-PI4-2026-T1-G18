// src/modules/mentor-ia/__tests__/alertas.regras.test.ts
// As regras de alerta (alertas.regras.ts) são funções puras: aqui não há banco nem relógio, o "hoje"
// de cada caso é passado explicitamente. Inclui o teste de propriedade com os dados do seed: nenhum
// "gasto fora do padrão" em nenhum dia de 2026.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  AlertaCandidato,
  TransacaoParaAlerta,
  dinheiroParado,
  faturaProxima,
  formatarReais,
  gastoForaDoPadrao,
  gerarAlertas,
} from "../alertas.regras";
import { diaEmBrasilia, inicioDoDia } from "../datas";
import { seedEm } from "./seed";

const UMA_HORA_MS = 60 * 60 * 1000;

// Instante a partir da data/hora de Brasília: brasilia("2026-11-09 12:30") = 2026-11-09T15:30Z
const brasilia = (dataHora: string) => new Date(`${dataHora.replace(" ", "T")}:00-03:00`);

// Transação mínima para as regras. Sem hora, a data é meio-dia de Brasília.
function transacao(
  tipo: TransacaoParaAlerta["tipo"],
  valor: number,
  categoria: string,
  quando: string,
  formaPagamento = "debito"
): TransacaoParaAlerta {
  return { tipo, valor, categoria, formaPagamento, data: brasilia(quando.includes(" ") ? quando : `${quando} 12:00`) };
}
const despesa = (valor: number, categoria: string, quando: string, forma?: string) =>
  transacao("despesa", valor, categoria, quando, forma);
const receita = (valor: number, categoria: string, quando: string) => transacao("receita", valor, categoria, quando, "pix");

const tipos = (alertas: AlertaCandidato[]) => alertas.map((a) => a.tipo);

// Todos os dias de 2026 no horário pedido de Brasília (ex.: 12.5 = 12:30)
function diasDe2026(hora: number): Date[] {
  return Array.from({ length: 365 }, (_, i) => new Date(inicioDoDia(2026, 0, 1 + i).getTime() + hora * UMA_HORA_MS));
}

// Nem ticker da B3 (PETR4, BOVA11), nem nome de produto, ativo ou instituição
const PARECE_ATIVO =
  /\b[A-Z]{4}\d{1,2}\b|\b(CDB|LCI|LCA|CRI|CRA|ETF|FII|Tesouro|Selic|poupan[cç]a|a[cç][aã]o|a[cç][oõ]es|fundo|bitcoin|cripto|banco|corretora|Nubank|Ita[uú]|Bradesco)\b/i;

describe("formatarReais", () => {
  test("formato brasileiro, com ponto no milhar e vírgula nos centavos", () => {
    assert.equal(formatarReais(0), "R$ 0,00");
    assert.equal(formatarReais(1234.5), "R$ 1.234,50");
    assert.equal(formatarReais(1000000), "R$ 1.000.000,00");
    assert.equal(formatarReais(-1234.56), "-R$ 1.234,56");
    assert.equal(formatarReais(999.999), "R$ 1.000,00");
    assert.equal(formatarReais(0.1 + 0.2), "R$ 0,30");
  });
});

describe("gastoForaDoPadrao", () => {
  const HOJE = brasilia("2026-11-09 12:30");
  // agosto, setembro e outubro: maior mês = R$ 500
  const historico = [
    despesa(300, "Alimentacao", "2026-08-10"),
    despesa(400, "Alimentacao", "2026-09-10"),
    despesa(500, "Alimentacao", "2026-10-10"),
  ];

  test("dispara com o mês até hoje em 2× o maior mês anterior e R$ 200 a mais; chave, título, mensagem e dados", () => {
    const alertas = gastoForaDoPadrao([...historico, despesa(1000, "Alimentacao", "2026-11-05")], HOJE);

    assert.equal(alertas.length, 1);
    const [alerta] = alertas;
    assert.equal(alerta.tipo, "gasto_fora_do_padrao");
    assert.equal(alerta.chave, "gasto_fora_do_padrao:Alimentacao:2026-11");
    assert.equal(alerta.titulo, "Gasto fora do padrão em Alimentacao");
    assert.equal(
      alerta.mensagem,
      "Em novembro você já gastou R$ 1.000,00 com Alimentacao, 2,0 vezes o maior gasto mensal dessa " +
        "categoria nos últimos 3 meses (R$ 500,00)."
    );
    assert.deepEqual(alerta.dados, { categoria: "Alimentacao", valorAtual: 1000, maiorMesAnterior: 500, mediaMensal: 400 });
  });

  test("não dispara logo abaixo do fator 2×", () => {
    assert.deepEqual(gastoForaDoPadrao([...historico, despesa(999.99, "Alimentacao", "2026-11-05")], HOJE), []);
  });

  test("não dispara com menos de R$ 200 a mais, mesmo acima de 2×", () => {
    const pequeno = [despesa(150, "Lazer", "2026-09-10"), despesa(150, "Lazer", "2026-10-10")];

    // 2,3× o maior mês, mas só R$ 199,99 a mais
    assert.deepEqual(gastoForaDoPadrao([...pequeno, despesa(349.99, "Lazer", "2026-11-05")], HOJE), []);
    // exatamente R$ 200 a mais: dispara
    const alertas = gastoForaDoPadrao([...pequeno, despesa(350, "Lazer", "2026-11-05")], HOJE);
    assert.equal(alertas.length, 1);
    assert.match(alertas[0].mensagem, /R\$ 350,00 com Lazer, 2,3 vezes .* \(R\$ 150,00\)/);
  });

  test("precisa de gasto em pelo menos 2 dos 3 meses anteriores (o 4º mês para trás não conta)", () => {
    const atual = despesa(2000, "Alimentacao", "2026-11-05");

    // só outubro: usuário novo na categoria
    assert.deepEqual(gastoForaDoPadrao([despesa(500, "Alimentacao", "2026-10-10"), atual], HOJE), []);
    // julho fica fora da janela (agosto a outubro)
    assert.deepEqual(
      gastoForaDoPadrao([despesa(500, "Alimentacao", "2026-07-10"), despesa(500, "Alimentacao", "2026-10-10"), atual], HOJE),
      []
    );
    // agosto e outubro (setembro sem gasto): dispara, e a média é só dos meses com gasto
    const alertas = gastoForaDoPadrao(
      [despesa(300, "Alimentacao", "2026-08-10"), despesa(500, "Alimentacao", "2026-10-10"), atual],
      HOJE
    );
    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].dados.mediaMensal, 400);
  });

  test("conta só despesas da mesma categoria, e um alerta por categoria", () => {
    const transacoes = [
      ...historico,
      despesa(400, "Alimentacao", "2026-11-02"),
      receita(5000, "Alimentacao", "2026-11-03"), // receita não é gasto
      despesa(5000, "Moradia", "2026-11-03"), // categoria sem histórico
      despesa(100, "Lazer", "2026-09-01"),
      despesa(100, "Lazer", "2026-10-01"),
      despesa(900, "Lazer", "2026-11-01"),
    ];
    const alertas = gastoForaDoPadrao(transacoes, HOJE);
    assert.deepEqual(alertas.map((a) => a.chave), ["gasto_fora_do_padrao:Lazer:2026-11"]);
  });

  test("os meses são os de Brasília: 01/11 02:00 UTC ainda é outubro", () => {
    // R$ 600 às 23:00 de 31/10 em Brasília contam em outubro, não em novembro
    const transacoes = [
      despesa(200, "Lazer", "2026-09-10"),
      despesa(200, "Lazer", "2026-10-10"),
      { ...despesa(600, "Lazer", "2026-10-31"), data: new Date("2026-11-01T02:00:00Z") },
      despesa(600, "Lazer", "2026-11-05"),
    ];
    assert.deepEqual(gastoForaDoPadrao(transacoes, HOJE), []);

    // e 00:00 de 01/11 em Brasília (03:00 UTC) já é novembro
    transacoes[2] = { ...transacoes[2], data: new Date("2026-11-01T03:00:00Z") };
    assert.equal(gastoForaDoPadrao(transacoes, HOJE)[0]?.dados.valorAtual, 1200);
  });

  test("inclui o resto de hoje e nada de amanhã", () => {
    const hoje = [...historico, despesa(1000, "Alimentacao", "2026-11-09 23:59")];
    assert.equal(gastoForaDoPadrao(hoje, HOJE).length, 1);

    const amanha = [...historico, despesa(1000, "Alimentacao", "2026-11-10 00:00")];
    assert.deepEqual(gastoForaDoPadrao(amanha, HOJE), []);
  });

  test("em janeiro o histórico é de outubro a dezembro do ano anterior", () => {
    const transacoes = [
      despesa(300, "Alimentacao", "2025-11-10"),
      despesa(300, "Alimentacao", "2025-12-10"),
      despesa(800, "Alimentacao", "2026-01-05"),
    ];
    const [alerta] = gastoForaDoPadrao(transacoes, brasilia("2026-01-15 12:00"));
    assert.equal(alerta.chave, "gasto_fora_do_padrao:Alimentacao:2026-01");
    assert.match(alerta.mensagem, /^Em janeiro você já gastou R\$ 800,00/);
  });
});

describe("faturaProxima", () => {
  // ciclo da fatura que vence em 10/11: compras no crédito de 03/10 a 02/11
  const compras = [
    despesa(100, "Lazer", "2026-10-03 00:00", "credito"), // primeiro instante do ciclo
    despesa(250.5, "Alimentacao", "2026-10-20", "credito"),
    despesa(49.5, "Transporte", "2026-11-02 23:59", "credito"), // último dia do ciclo
    despesa(1000, "Lazer", "2026-10-02 23:59", "credito"), // fatura anterior
    despesa(1000, "Lazer", "2026-11-03 00:00", "credito"), // fatura seguinte (dezembro)
    despesa(1000, "Alimentacao", "2026-10-20", "debito"), // não é crédito
    transacao("receita", 1000, "Outros", "2026-10-20", "credito"), // estorno/receita não entra
  ];

  test("só do dia 5 ao dia 10 (5 dias ou menos para o vencimento do dia 10)", () => {
    const comAlerta: number[] = [];
    for (let dia = 1; dia <= 30; dia++) {
      if (faturaProxima(compras, brasilia(`2026-11-${String(dia).padStart(2, "0")} 12:00`)).length > 0) comAlerta.push(dia);
    }
    assert.deepEqual(comAlerta, [5, 6, 7, 8, 9, 10]);
  });

  test("soma só as despesas no crédito do ciclo (dia 3 do mês anterior ao dia 2 do mês)", () => {
    const [alerta] = faturaProxima(compras, brasilia("2026-11-05 12:00"));

    assert.equal(alerta.tipo, "fatura_proxima");
    assert.equal(alerta.chave, "fatura_proxima:2026-11");
    assert.equal(alerta.titulo, "Fatura do cartão perto do vencimento");
    assert.deepEqual(alerta.dados, {
      valor: 400,
      vencimento: "2026-11-10T03:00:00.000Z",
      diasParaVencer: 5,
      inicioDoCiclo: "2026-10-03T03:00:00.000Z",
      fechamento: "2026-11-03T03:00:00.000Z",
    });
    assert.equal(
      alerta.mensagem,
      "A fatura do cartão de crédito vence em 5 dias (10/11): são R$ 400,00 em compras no crédito de 03/10 a " +
        "02/11. Reserve esse valor para não pagar juros."
    );
  });

  test("mensagem de véspera e do dia do vencimento", () => {
    assert.match(faturaProxima(compras, brasilia("2026-11-09 12:00"))[0].mensagem, /vence amanhã \(10\/11\)/);
    assert.match(faturaProxima(compras, brasilia("2026-11-10 12:00"))[0].mensagem, /vence hoje \(10\/11\)/);
  });

  test("fatura sem valor: nenhum alerta", () => {
    const semCredito = compras.filter((t) => t.formaPagamento !== "credito" || t.data < brasilia("2026-10-03 00:00"));
    assert.deepEqual(faturaProxima(semCredito, brasilia("2026-11-07 12:00")), []);
    assert.deepEqual(faturaProxima([], brasilia("2026-11-07 12:00")), []);
  });

  test("o dia é o de Brasília: 05/11 02:00 UTC ainda é dia 4", () => {
    assert.deepEqual(faturaProxima(compras, new Date("2026-11-05T02:00:00Z")), []);
    assert.equal(faturaProxima(compras, new Date("2026-11-05T03:00:00Z"))[0]?.dados.diasParaVencer, 5);
    // 11/11 02:00 UTC ainda é 10/11 em Brasília: a fatura vence hoje
    assert.equal(faturaProxima(compras, new Date("2026-11-11T02:00:00Z"))[0]?.dados.diasParaVencer, 0);
    assert.deepEqual(faturaProxima(compras, new Date("2026-11-11T03:00:00Z")), []);
  });

  test("na virada do ano o ciclo é de dezembro a janeiro", () => {
    const transacoes = [despesa(80, "Lazer", "2026-12-20", "credito"), despesa(20, "Lazer", "2027-01-02", "credito")];
    const [alerta] = faturaProxima(transacoes, brasilia("2027-01-07 12:00"));
    assert.equal(alerta.chave, "fatura_proxima:2027-01");
    assert.equal(alerta.dados.valor, 100);
    assert.equal(alerta.dados.inicioDoCiclo, "2026-12-03T03:00:00.000Z");
  });
});

describe("dinheiroParado", () => {
  const HOJE = brasilia("2026-11-09 12:30");
  // receitas e despesas de agosto a outubro
  function meses(receitaMensal: number, despesaMensal: number) {
    return ["2026-08", "2026-09", "2026-10"].flatMap((m) => [
      receita(receitaMensal, "Salario", `${m}-05`),
      despesa(despesaMensal, "Moradia", `${m}-10`),
    ]);
  }

  test("dispara com sobra de pelo menos 1 mês de despesas; mensagem educativa e dados", () => {
    const [alerta] = dinheiroParado(meses(3000, 2000), HOJE);

    assert.equal(alerta.tipo, "dinheiro_parado");
    assert.equal(alerta.chave, "dinheiro_parado:2026-11");
    assert.equal(alerta.titulo, "Dinheiro parado na conta");
    assert.deepEqual(alerta.dados, {
      saldo: 3000,
      receitas: 9000,
      despesas: 6000,
      despesaMensalMedia: 2000,
      desde: "2026-08-01T03:00:00.000Z",
    });
    assert.match(alerta.mensagem, /^Desde 01\/08 sobraram R\$ 3\.000,00 .*\(R\$ 2\.000,00 em média\)/);
    assert.match(alerta.mensagem, /reserva de emergência/);
  });

  test("não dispara com sobra menor que 1 mês de despesas", () => {
    // sobra R$ 1.500, gasta R$ 2.000 por mês
    assert.deepEqual(dinheiroParado(meses(2500, 2000), HOJE), []);
    // exatamente 1 mês de despesas: dispara
    assert.equal(dinheiroParado(meses(2666.67, 2000), HOJE).length, 1);
  });

  test("não dispara abaixo do saldo mínimo de R$ 500", () => {
    const pouco = (ultimaReceita: number) => [
      ...meses(0, 100),
      receita(ultimaReceita, "Salario", "2026-11-05"),
    ];
    // R$ 799,99 - R$ 300 = R$ 499,99 (mais de 1 mês de despesas, mas abaixo do mínimo)
    assert.deepEqual(dinheiroParado(pouco(799.99), HOJE), []);
    assert.equal(dinheiroParado(pouco(800), HOJE)[0]?.dados.saldo, 500);
  });

  test("qualquer transação em categoria de investimento no período suprime o alerta", () => {
    for (const categoria of ["Investimento", "Investimentos", "investimentos", "INVESTIMENTO", " Investimentos ", "Invéstimentos"]) {
      const transacoes = [...meses(3000, 2000), despesa(100, categoria, "2026-09-15")];
      assert.deepEqual(dinheiroParado(transacoes, HOJE), [], categoria);
    }
    // receita de investimento (resgate) também conta
    assert.deepEqual(dinheiroParado([...meses(3000, 2000), receita(50, "Investimentos", "2026-11-02")], HOJE), []);
    // investimento fora do período lido (julho) não suprime
    assert.equal(dinheiroParado([...meses(3000, 2000), despesa(100, "Investimentos", "2026-07-15")], HOJE).length, 1);
  });

  test("precisa de movimento em pelo menos 2 dos 3 meses anteriores", () => {
    const soOutubroENovembro = [receita(5000, "Salario", "2026-10-05"), despesa(100, "Lazer", "2026-11-02")];
    assert.deepEqual(dinheiroParado(soOutubroENovembro, HOJE), []);
    assert.deepEqual(dinheiroParado([receita(5000, "Salario", "2026-11-05")], HOJE), []);
    // setembro e outubro bastam
    const doisMeses = [receita(5000, "Salario", "2026-09-05"), ...soOutubroENovembro];
    assert.equal(dinheiroParado(doisMeses, HOJE).length, 1);
  });

  test("a mensagem nunca cita ativo, produto ou instituição", () => {
    for (const [r, d] of [[3000, 2000], [1_000_000, 10], [9999.99, 1234.56]]) {
      const [alerta] = dinheiroParado(meses(r, d), HOJE);
      assert.doesNotMatch(alerta.mensagem, PARECE_ATIVO);
      assert.doesNotMatch(alerta.titulo, PARECE_ATIVO);
    }
  });
});

describe("gerarAlertas com os dados do seed", () => {
  test("nenhum gasto_fora_do_padrao em nenhum dia de 2026 (00:30, 12:30 e 23:30 de Brasília)", () => {
    const falsosPositivos: string[] = [];
    for (const hora of [0.5, 12.5, 23.5]) {
      for (const hoje of diasDe2026(hora)) {
        for (const alerta of gerarAlertas(seedEm(hoje), hoje)) {
          if (alerta.tipo === "gasto_fora_do_padrao") falsosPositivos.push(`${hoje.toISOString()} ${alerta.chave}`);
        }
      }
    }
    assert.deepEqual(falsosPositivos, []);
  });

  test("só alertas verdadeiros: fatura_proxima do dia 5 ao 10 e dinheiro_parado todos os dias, sem citar ativo", () => {
    for (const hoje of diasDe2026(12.5)) {
      const alertas = gerarAlertas(seedEm(hoje), hoje);
      const { dia } = diaEmBrasilia(hoje);
      const esperado = dia >= 5 && dia <= 10 ? ["fatura_proxima", "dinheiro_parado"] : ["dinheiro_parado"];
      assert.deepEqual(tipos(alertas), esperado, hoje.toISOString());
      for (const alerta of alertas) assert.doesNotMatch(alerta.mensagem, PARECE_ATIVO, hoje.toISOString());
    }
  });

  test("seed + despesa de R$ 1.500 em Alimentacao hoje: gera o gasto_fora_do_padrao (contrato, seção 3.5)", () => {
    const comGastoAlto = (hoje: Date) => [...seedEm(hoje), { ...despesa(1500, "Alimentacao", "2026-01-01"), data: hoje }];

    const hoje = brasilia("2026-11-09 12:30");
    const [alerta] = gastoForaDoPadrao(comGastoAlto(hoje), hoje);
    assert.equal(alerta?.chave, "gasto_fora_do_padrao:Alimentacao:2026-11");

    // No dia 1 o mês anterior ainda tem as compras recentes do seed e R$ 1.500 não chegam ao dobro dele;
    // nos outros dias o alerta aparece (353 de 365).
    const semAlerta = diasDe2026(12.5)
      .filter((d) => gastoForaDoPadrao(comGastoAlto(d), d).length === 0)
      .map((d) => diaEmBrasilia(d).dia);
    assert.ok(semAlerta.length <= 25, `sem alerta em ${semAlerta.length} dias`);
    assert.ok(semAlerta.every((dia) => dia === 1), "só falta alerta no dia 1 do mês");
  });
});
