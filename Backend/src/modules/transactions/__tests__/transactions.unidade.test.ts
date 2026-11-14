// src/modules/transactions/__tests__/transactions.unidade.test.ts
// Testes de unidade das regras de transações (issue #59), sem HTTP e sem banco: os esquemas de validação (zod) e a
// categorização pelo Servidor Java (simulado). Rápidos, para pegar um erro de regra antes dos testes de rota.
import "./ambiente";
import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";
import {
  bulkDeleteSchema,
  bulkUpdateSchema,
  createTransactionSchema,
  duplicateTransactionSchema,
  transactionFiltersSchema,
  transactionIdSchema,
  updateTransactionSchema,
} from "../transactions.dto";
import { transactionsService } from "../transactions.service";

afterEach(() => mock.restoreAll());

const ID = "6ad3fd7c273f8f0946dd77e5";
const ID2 = "6ad3fd7c273f8f0946dd77e6";
const valida = { tipo: "despesa", valor: 10, data: "2026-10-05", descricao: "Teste" };

describe("createTransactionSchema", () => {
  test("campos opcionais ganham valores padrão: forma 'outro' e origem 'manual'", () => {
    const dados = createTransactionSchema.parse(valida);
    assert.equal(dados.formaPagamento, "outro");
    assert.equal(dados.origem, "manual");
    assert.equal(dados.categoria, undefined);
    assert.equal(dados.observacoes, undefined);
  });

  test("a data vira Date (aceita só a data ou o instante completo)", () => {
    assert.equal(createTransactionSchema.parse(valida).data.toISOString(), "2026-10-05T00:00:00.000Z");
    assert.equal(createTransactionSchema.parse({ ...valida, data: "2026-10-05T12:30:00Z" }).data.toISOString(), "2026-10-05T12:30:00.000Z");
  });

  test("remove espaços das pontas e transforma observação em branco em 'sem observação'", () => {
    const dados = createTransactionSchema.parse({ ...valida, descricao: "  Feira ", categoria: " Lazer ", observacoes: "   " });
    assert.equal(dados.descricao, "Feira");
    assert.equal(dados.categoria, "Lazer");
    assert.equal(dados.observacoes, undefined);
  });

  test("recusa valor que não é número positivo", () => {
    for (const valor of [0, -1, "10", null, NaN]) {
      assert.equal(createTransactionSchema.safeParse({ ...valida, valor }).success, false, String(valor));
    }
  });

  test("recusa tipo, forma de pagamento e origem fora da lista", () => {
    assert.equal(createTransactionSchema.safeParse({ ...valida, tipo: "transferencia" }).success, false);
    assert.equal(createTransactionSchema.safeParse({ ...valida, formaPagamento: "cheque" }).success, false);
    assert.equal(createTransactionSchema.safeParse({ ...valida, origem: "robo" }).success, false);
  });

  test("observação: 300 caracteres passa, 301 não", () => {
    assert.equal(createTransactionSchema.safeParse({ ...valida, observacoes: "x".repeat(300) }).success, true);
    assert.equal(createTransactionSchema.safeParse({ ...valida, observacoes: "x".repeat(301) }).success, false);
  });
});

describe("transactionFiltersSchema", () => {
  test("sem parâmetros: página 1 e 20 por página", () => {
    const filtros = transactionFiltersSchema.parse({});
    assert.equal(filtros.pagina, 1);
    assert.equal(filtros.limite, 20);
  });

  test("números e datas chegam como texto na query e são convertidos", () => {
    const filtros = transactionFiltersSchema.parse({ pagina: "2", limite: "50", valorMin: "10.5", dataInicio: "2026-10-01" });
    assert.equal(filtros.pagina, 2);
    assert.equal(filtros.limite, 50);
    assert.equal(filtros.valorMin, 10.5);
    assert.equal(filtros.dataInicio?.toISOString(), "2026-10-01T00:00:00.000Z");
  });

  test("limite vai de 1 a 100 e a página começa em 1", () => {
    assert.equal(transactionFiltersSchema.safeParse({ limite: "100" }).success, true);
    assert.equal(transactionFiltersSchema.safeParse({ limite: "101" }).success, false);
    assert.equal(transactionFiltersSchema.safeParse({ limite: "0" }).success, false);
    assert.equal(transactionFiltersSchema.safeParse({ pagina: "0" }).success, false);
  });

  test("intervalos de um só ponto são válidos (início igual ao fim, mínimo igual ao máximo)", () => {
    assert.equal(transactionFiltersSchema.safeParse({ dataInicio: "2026-10-01", dataFim: "2026-10-01" }).success, true);
    assert.equal(transactionFiltersSchema.safeParse({ valorMin: "5", valorMax: "5" }).success, true);
  });

  test("início depois do fim e mínimo maior que o máximo são recusados, apontando o campo", () => {
    const datas = transactionFiltersSchema.safeParse({ dataInicio: "2026-10-31", dataFim: "2026-10-01" });
    const valores = transactionFiltersSchema.safeParse({ valorMin: "10", valorMax: "5" });
    assert.equal(datas.success, false);
    assert.equal(valores.success, false);
    assert.deepEqual(datas.error?.issues.map((i) => i.path[0]), ["dataInicio"]);
    assert.deepEqual(valores.error?.issues.map((i) => i.path[0]), ["valorMin"]);
  });

  test("busca: de 1 a 100 caracteres, depois de aparar os espaços", () => {
    assert.equal(transactionFiltersSchema.safeParse({ busca: "   " }).success, false);
    assert.equal(transactionFiltersSchema.safeParse({ busca: "x".repeat(100) }).success, true);
    assert.equal(transactionFiltersSchema.safeParse({ busca: "x".repeat(101) }).success, false);
  });
});

describe("updateTransactionSchema e lotes", () => {
  test("a alteração é parcial: basta um campo, e nenhum valor padrão é inventado", () => {
    assert.deepEqual(updateTransactionSchema.parse({ valor: 5 }), { valor: 5 });
  });

  test("campos desconhecidos (origem, userId) são descartados", () => {
    assert.deepEqual(updateTransactionSchema.parse({ valor: 5, origem: "pluggy", userId: "beto" }), { valor: 5 });
  });

  test("sem nenhum campo conhecido é recusado", () => {
    assert.equal(updateTransactionSchema.safeParse({}).success, false);
    assert.equal(updateTransactionSchema.safeParse({ origem: "pluggy" }).success, false);
  });

  test("observação '' passa (é o pedido de apagar) e não é aparada para undefined", () => {
    assert.deepEqual(updateTransactionSchema.parse({ observacoes: "" }), { observacoes: "" });
  });

  test("categoria e descrição não podem ficar em branco na edição", () => {
    assert.equal(updateTransactionSchema.safeParse({ categoria: "  " }).success, false);
    assert.equal(updateTransactionSchema.safeParse({ descricao: "" }).success, false);
  });

  test("lote de edição: de 1 a 100 itens, sem ids repetidos e com ids bem formados", () => {
    const item = (id: string) => ({ id, alteracoes: { valor: 1 } });
    assert.equal(bulkUpdateSchema.safeParse({ itens: [item(ID)] }).success, true);
    assert.equal(bulkUpdateSchema.safeParse({ itens: [] }).success, false);
    assert.equal(bulkUpdateSchema.safeParse({ itens: [item(ID), item(ID)] }).success, false);
    assert.equal(bulkUpdateSchema.safeParse({ itens: [item("abc")] }).success, false);
    const cem = Array.from({ length: 100 }, (_, i) => item(i.toString(16).padStart(24, "0")));
    assert.equal(bulkUpdateSchema.safeParse({ itens: cem }).success, true);
    assert.equal(bulkUpdateSchema.safeParse({ itens: [...cem, item(ID)] }).success, false);
  });

  test("lote de exclusão: de 1 a 100 ids, sem repetidos e bem formados", () => {
    assert.equal(bulkDeleteSchema.safeParse({ ids: [ID, ID2] }).success, true);
    assert.equal(bulkDeleteSchema.safeParse({ ids: [] }).success, false);
    assert.equal(bulkDeleteSchema.safeParse({ ids: [ID, ID] }).success, false);
    assert.equal(bulkDeleteSchema.safeParse({ ids: ["123"] }).success, false);
  });

  test("id de transação: 24 caracteres hexadecimais (maiúsculas também)", () => {
    assert.equal(transactionIdSchema.safeParse(ID).success, true);
    assert.equal(transactionIdSchema.safeParse(ID.toUpperCase()).success, true);
    for (const ruim of ["", "abc", ID + "0", "g".repeat(24)]) {
      assert.equal(transactionIdSchema.safeParse(ruim).success, false, ruim);
    }
  });
});

describe("duplicateTransactionSchema", () => {
  test("o corpo é opcional: sem corpo vale {} e a data fica em aberto", () => {
    assert.deepEqual(duplicateTransactionSchema.parse(undefined), {});
    assert.deepEqual(duplicateTransactionSchema.parse({}), {});
  });

  test("aceita a data do novo lançamento e recusa data inválida", () => {
    assert.equal(duplicateTransactionSchema.parse({ data: "2026-12-05" }).data?.toISOString(), "2026-12-05T00:00:00.000Z");
    assert.equal(duplicateTransactionSchema.safeParse({ data: "ontem" }).success, false);
  });
});

describe("transactionsService.sugerirCategoria (Servidor Java simulado)", () => {
  test("devolve a categoria que o Servidor responde e envia a descrição e o valor", async () => {
    const pedidos: unknown[] = [];
    mock.method(javaServerClient, "enviarPedido", async (tipo: string, resposta: string, dados: unknown) => {
      pedidos.push({ tipo, resposta, dados });
      return { categoria: "Alimentacao" };
    });

    assert.equal(await transactionsService.sugerirCategoria("Uber Eats", 32.5), "Alimentacao");
    assert.deepEqual(pedidos, [
      { tipo: "PedidoCategorizarTransacao", resposta: "RespostaCategorizarTransacao", dados: { descricao: "Uber Eats", valor: 32.5 } },
    ]);
  });

  for (const code of ["JAVA_SERVER_UNAVAILABLE", "JAVA_SERVER_SHUTTING_DOWN"]) {
    test(`${code}: cai em 'Outros' e avisa no log`, async () => {
      mock.method(javaServerClient, "enviarPedido", async () => {
        throw new AppError("fora do ar", 503, code);
      });
      const avisos: unknown[][] = [];
      mock.method(console, "warn", (...args: unknown[]) => avisos.push(args));

      assert.equal(await transactionsService.sugerirCategoria("Netflix", 39.9), "Outros");
      assert.equal(avisos.length, 1);
    });
  }

  test("qualquer outro erro do Servidor continua sendo erro (contrato quebrado não pode ser escondido)", async () => {
    mock.method(javaServerClient, "enviarPedido", async () => {
      throw new AppError("Tipo desconhecido", 400, "UNKNOWN_TYPE");
    });
    await assert.rejects(() => transactionsService.sugerirCategoria("Netflix", 39.9), { code: "UNKNOWN_TYPE" });
  });

  test("erro que não é do Servidor (um bug qualquer) também não é engolido", async () => {
    mock.method(javaServerClient, "enviarPedido", async () => {
      throw new TypeError("falha inesperada");
    });
    await assert.rejects(() => transactionsService.sugerirCategoria("Netflix", 39.9), TypeError);
  });
});
