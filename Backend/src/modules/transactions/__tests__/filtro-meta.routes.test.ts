// src/modules/transactions/__tests__/filtro-meta.routes.test.ts
// GET /v1/transactions?metaId=: só as transações vinculadas a uma meta, ou só as sem meta ("nenhuma").
import { ANA, BETO, inserir, json, prepararApi } from "./apoio";
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { TransactionModel } from "../transactions.model";

const { chamar } = prepararApi();
const META_A = "a".repeat(24);
const META_B = "b".repeat(24);
const listar = (consulta: string, token = ANA) => chamar("GET", `/transactions?${consulta}`, token);
const descricoes = (corpo: any) => corpo.itens.map((t: any) => t.descricao).sort();

describe("GET /v1/transactions: filtro por meta", () => {
  beforeEach(async () => {
    await TransactionModel.deleteMany({});
    await inserir("ana", { descricao: "Aporte A1", metaId: META_A });
    await inserir("ana", { descricao: "Aporte A2", metaId: META_A });
    await inserir("ana", { descricao: "Aporte B", metaId: META_B });
    await inserir("ana", { descricao: "Sem meta" });
    await inserir("beto", { descricao: "Do Beto", metaId: META_A });
  });

  test("um id de meta traz só as transações dela (e só as do usuário)", async () => {
    assert.deepEqual(descricoes(await json(await listar(`metaId=${META_A}`))), ["Aporte A1", "Aporte A2"]);
    assert.deepEqual(descricoes(await json(await listar(`metaId=${META_A}`, BETO))), ["Do Beto"]);
  });

  test("'nenhuma' traz só as sem meta", async () => {
    assert.deepEqual(descricoes(await json(await listar("metaId=nenhuma"))), ["Sem meta"]);
  });

  test("o resumo também respeita o filtro", async () => {
    const corpo = await json(await listar(`metaId=${META_B}`));
    assert.equal(corpo.total, 1);
    assert.equal(corpo.resumo.despesas + corpo.resumo.receitas > 0, true);
  });

  test("valor que não é id nem 'nenhuma' dá 400", async () => {
    const resposta = await listar("metaId=qualquer");
    assert.equal(resposta.status, 400);
    assert.equal((await json(resposta)).error.code, "VALIDATION_ERROR");
  });
});
