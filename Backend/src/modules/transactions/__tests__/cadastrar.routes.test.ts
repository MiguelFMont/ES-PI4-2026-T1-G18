// src/modules/transactions/__tests__/cadastrar.routes.test.ts
// POST /v1/transactions de ponta a ponta no Backend (issue #59): cadastro com e sem categoria, categorização pelo
// Servidor Java (simulado), Servidor fora do ar e validação dos campos.
import { ANA, TRANSACAO_VALIDA, json, prepararApi, textoDe } from "./apoio";
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";
import { TransactionModel } from "../transactions.model";
import { simularCategorizacao } from "../../connected-accounts/__tests__/apoio";

const { chamar, chamarComTexto } = prepararApi();

// `null` = chamada sem login (um parâmetro padrão trocaria o undefined pelo token da Ana)
const cadastrar = (corpo: unknown, token: string | null = ANA) => chamar("POST", "/transactions", token ?? undefined, corpo);

describe("POST /v1/transactions: cadastro", () => {
  test("cria com todos os campos e devolve o objeto Transaction (201), sem expor dados internos", async () => {
    const pedidos = simularCategorizacao();
    const resposta = await cadastrar({ ...TRANSACAO_VALIDA, observacoes: "compra do mês" });
    const criada = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.match(criada.id, /^[a-f\d]{24}$/);
    const { id: _id, ...semId } = criada;
    assert.deepEqual(semId, { ...TRANSACAO_VALIDA, observacoes: "compra do mês", origem: "manual" });
    assert.equal(pedidos.length, 0, "com categoria informada, o Servidor não é consultado");
    for (const interno of ["userId", "_id", "__v", "createdAt", "updatedAt"]) {
      assert.ok(!(interno in criada), `${interno} não pode aparecer na resposta`);
    }
  });

  test("grava no banco para o usuário do token", async () => {
    await cadastrar(TRANSACAO_VALIDA);
    const gravada = await TransactionModel.findOne().lean();
    assert.equal(gravada?.userId, "ana");
    assert.equal(await TransactionModel.countDocuments(), 1);
  });

  test("requisição mínima: forma de pagamento vira 'outro', origem 'manual' e a categoria vem do Servidor", async () => {
    const pedidos = simularCategorizacao();
    const resposta = await cadastrar({ tipo: "receita", valor: 1500, data: "2026-10-01", descricao: "Salario" });
    const criada = await json(resposta);

    assert.equal(resposta.status, 201);
    assert.equal(criada.formaPagamento, "outro");
    assert.equal(criada.origem, "manual");
    assert.equal(criada.categoria, "Salario");
    assert.equal(criada.data, "2026-10-01T00:00:00.000Z");
    assert.ok(!("observacoes" in criada));
    assert.deepEqual(pedidos, [{ descricao: "Salario", valor: 1500 }]);
  });

  test("categoria informada é usada como está (texto livre), sem consultar o Servidor", async () => {
    const pedidos = simularCategorizacao();
    const criada = await json(await cadastrar({ ...TRANSACAO_VALIDA, categoria: "Pets" }));
    assert.equal(criada.categoria, "Pets");
    assert.equal(pedidos.length, 0);
  });

  test("Servidor sem palavra-chave conhecida: a categoria é 'Outros'", async () => {
    simularCategorizacao();
    const { categoria: _c, ...semCategoria } = TRANSACAO_VALIDA;
    const criada = await json(await cadastrar({ ...semCategoria, descricao: "Coisa qualquer" }));
    assert.equal(criada.categoria, "Outros");
  });

  test("Servidor Java fora do ar: salva com 'Outros' e o cadastro não falha", async () => {
    simularCategorizacao({ indisponivel: true });
    mock.method(console, "warn", () => {}); // o service avisa no log; aqui o aviso é esperado
    const { categoria: _c, ...semCategoria } = TRANSACAO_VALIDA;
    const resposta = await cadastrar({ ...semCategoria, descricao: "Netflix" });

    assert.equal(resposta.status, 201);
    assert.equal((await json(resposta)).categoria, "Outros");
    assert.equal(await TransactionModel.countDocuments(), 1);
  });

  test("Servidor Java desligando (JAVA_SERVER_SHUTTING_DOWN) também cai em 'Outros'", async () => {
    mock.method(javaServerClient, "enviarPedido", async () => {
      throw new AppError("Servidor desligando", 503, "JAVA_SERVER_SHUTTING_DOWN");
    });
    mock.method(console, "warn", () => {});
    const { categoria: _c, ...semCategoria } = TRANSACAO_VALIDA;
    const resposta = await cadastrar(semCategoria);
    assert.equal(resposta.status, 201);
    assert.equal((await json(resposta)).categoria, "Outros");
  });

  test("erro inesperado do Servidor (contrato quebrado) não vira 'Outros': o cadastro falha e nada é salvo", async () => {
    mock.method(javaServerClient, "enviarPedido", async () => {
      throw new AppError("Tipo desconhecido", 400, "UNKNOWN_TYPE");
    });
    const { categoria: _c, ...semCategoria } = TRANSACAO_VALIDA;
    const resposta = await cadastrar(semCategoria);

    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "UNKNOWN_TYPE");
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("espaços nas pontas da descrição e da observação são removidos", async () => {
    const criada = await json(await cadastrar({ ...TRANSACAO_VALIDA, descricao: "  Feira  ", observacoes: "  anotação  " }));
    assert.equal(criada.descricao, "Feira");
    assert.equal(criada.observacoes, "anotação");
  });

  test("observação em branco é o mesmo que não enviar: o campo nem aparece", async () => {
    const criada = await json(await cadastrar({ ...TRANSACAO_VALIDA, observacoes: "   " }));
    assert.ok(!("observacoes" in criada));
    assert.ok(!("observacoes" in (await TransactionModel.findOne().lean())!));
  });

  test("observação com exatamente 300 caracteres é aceita", async () => {
    const resposta = await cadastrar({ ...TRANSACAO_VALIDA, observacoes: textoDe(300) });
    assert.equal(resposta.status, 201);
  });

  test("cada forma de pagamento da lista é aceita", async () => {
    for (const forma of ["dinheiro", "pix", "debito", "credito", "boleto", "outro"]) {
      const resposta = await cadastrar({ ...TRANSACAO_VALIDA, formaPagamento: forma });
      assert.equal(resposta.status, 201, forma);
    }
    assert.equal(await TransactionModel.countDocuments(), 6);
  });

  // Comportamento ATUAL, registrado de propósito: o contrato (seção 2.4) aceita `origem: "pluggy"` no cadastro, então um
  // usuário consegue criar à mão um lançamento que se diz importado (e esse lançamento deixa de poder ser duplicado).
  // Se isso mudar para aceitar só "manual", este teste avisa e o contrato precisa mudar junto.
  test("aceita origem 'pluggy' no corpo, como diz o contrato", async () => {
    const resposta = await cadastrar({ ...TRANSACAO_VALIDA, origem: "pluggy" });
    assert.equal(resposta.status, 201);
    assert.equal((await json(resposta)).origem, "pluggy");
  });

  test("valor decimal é guardado como veio", async () => {
    const criada = await json(await cadastrar({ ...TRANSACAO_VALIDA, valor: 0.01 }));
    assert.equal(criada.valor, 0.01);
  });
});

describe("POST /v1/transactions: validação (400 VALIDATION_ERROR, e nada é salvo)", () => {
  // cada caso: o que está errado, o corpo e o campo que a API deve apontar em `details`
  const casos: { nome: string; corpo: Record<string, unknown>; campo: string }[] = [
    { nome: "valor zero", corpo: { ...TRANSACAO_VALIDA, valor: 0 }, campo: "valor" },
    { nome: "valor negativo", corpo: { ...TRANSACAO_VALIDA, valor: -5 }, campo: "valor" },
    { nome: "valor como texto (o contrato recusa \"10\")", corpo: { ...TRANSACAO_VALIDA, valor: "10" }, campo: "valor" },
    { nome: "sem valor", corpo: { ...TRANSACAO_VALIDA, valor: undefined }, campo: "valor" },
    { nome: "tipo desconhecido", corpo: { ...TRANSACAO_VALIDA, tipo: "transferencia" }, campo: "tipo" },
    { nome: "sem tipo", corpo: { ...TRANSACAO_VALIDA, tipo: undefined }, campo: "tipo" },
    { nome: "descrição só com espaços", corpo: { ...TRANSACAO_VALIDA, descricao: "   " }, campo: "descricao" },
    { nome: "sem descrição", corpo: { ...TRANSACAO_VALIDA, descricao: undefined }, campo: "descricao" },
    { nome: "data inválida", corpo: { ...TRANSACAO_VALIDA, data: "ontem" }, campo: "data" },
    { nome: "sem data", corpo: { ...TRANSACAO_VALIDA, data: undefined }, campo: "data" },
    { nome: "observação com 301 caracteres", corpo: { ...TRANSACAO_VALIDA, observacoes: textoDe(301) }, campo: "observacoes" },
    { nome: "forma de pagamento desconhecida", corpo: { ...TRANSACAO_VALIDA, formaPagamento: "cheque" }, campo: "formaPagamento" },
    { nome: "categoria só com espaços", corpo: { ...TRANSACAO_VALIDA, categoria: "   " }, campo: "categoria" },
    { nome: "origem desconhecida", corpo: { ...TRANSACAO_VALIDA, origem: "robo" }, campo: "origem" },
  ];

  for (const { nome, corpo, campo } of casos) {
    test(nome, async () => {
      const resposta = await cadastrar(corpo);
      const erro = (await json(resposta)).error;

      assert.equal(resposta.status, 400);
      assert.equal(erro.code, "VALIDATION_ERROR");
      assert.ok(Array.isArray(erro.details?.[campo]), `details deve apontar o campo ${campo}`);
      assert.equal(await TransactionModel.countDocuments(), 0);
    });
  }

  test("vários campos errados de uma vez: todos aparecem em details", async () => {
    const resposta = await cadastrar({ tipo: "transferencia", valor: -5, data: "ontem", descricao: " ", formaPagamento: "cheque" });
    const { details } = (await json(resposta)).error;

    assert.equal(resposta.status, 400);
    for (const campo of ["tipo", "valor", "data", "descricao", "formaPagamento"]) {
      assert.ok(campo in details, campo);
    }
  });

  test("corpo que não é JSON: 400 VALIDATION_ERROR", async () => {
    const resposta = await chamarComTexto("POST", "/transactions", ANA, "{ isso não é json");
    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
    assert.equal(await TransactionModel.countDocuments(), 0);
  });
});

describe("POST /v1/transactions: autenticação", () => {
  test("sem token: 401 UNAUTHENTICATED", async () => {
    const resposta = await cadastrar(TRANSACAO_VALIDA, null);
    assert.equal(resposta.status, 401);
    assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("token inválido: 401 UNAUTHENTICATED", async () => {
    const resposta = await cadastrar(TRANSACAO_VALIDA, "isto.nao.e.um.token");
    assert.equal(resposta.status, 401);
    assert.equal((await json(resposta)).error.code, "UNAUTHENTICATED");
  });

  test("o id do dono vem do token, nunca do corpo", async () => {
    await cadastrar({ ...TRANSACAO_VALIDA, userId: "beto" });
    const gravada = await TransactionModel.findOne().lean();
    assert.equal(gravada?.userId, "ana");
  });
});
