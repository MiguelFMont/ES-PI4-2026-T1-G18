// src/modules/transactions/__tests__/importadas.repository.test.ts
// Importação de transações (issue #59), no nível do repositório: o que a importação da Pluggy usa para não duplicar.
// O fluxo completo (Pluggy simulada, sincronizações, categorias) é testado em connected-accounts; aqui ficam as garantias
// do banco: o índice único { userId, externalId } e a inserção que não para no primeiro duplicado.
import "./ambiente";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { TransactionDocument, TransactionModel } from "../transactions.model";
import { transactionsRepository } from "../transactions.repository";
import { encerrarBanco, iniciarBanco, limparBanco } from "../../connected-accounts/__tests__/banco";

before(async () => {
  await iniciarBanco();
  await TransactionModel.syncIndexes(); // o índice único é o que as garantias abaixo testam
});
after(encerrarBanco);
beforeEach(limparBanco);

const importada = (userId: string, externalId: string, extra: Partial<TransactionDocument> = {}): TransactionDocument => ({
  userId,
  tipo: "despesa",
  valor: 10,
  categoria: "Outros",
  data: new Date("2026-10-05T12:00:00Z"),
  descricao: `importada ${externalId}`,
  formaPagamento: "credito",
  origem: "pluggy",
  externalId,
  ...extra,
});

describe("transactionsRepository.inserirImportadas", () => {
  test("insere todas e devolve quantas entraram", async () => {
    const entraram = await transactionsRepository.inserirImportadas([importada("ana", "a"), importada("ana", "b"), importada("ana", "c")]);
    assert.equal(entraram, 3);
    assert.equal(await TransactionModel.countDocuments({ origem: "pluggy" }), 3);
  });

  test("lista vazia: devolve 0 sem tocar no banco", async () => {
    assert.equal(await transactionsRepository.inserirImportadas([]), 0);
    assert.equal(await TransactionModel.countDocuments(), 0);
  });

  test("a mesma transação da Pluggy não entra duas vezes para o mesmo usuário", async () => {
    await transactionsRepository.inserirImportadas([importada("ana", "a")]);
    const entraram = await transactionsRepository.inserirImportadas([importada("ana", "a")]);
    assert.equal(entraram, 0);
    assert.equal(await TransactionModel.countDocuments(), 1);
  });

  test("um duplicado no meio não impede as novas de entrar (a inserção não para no primeiro erro)", async () => {
    await transactionsRepository.inserirImportadas([importada("ana", "b")]);
    const entraram = await transactionsRepository.inserirImportadas([importada("ana", "a"), importada("ana", "b"), importada("ana", "c")]);

    assert.equal(entraram, 2);
    const externalIds = (await TransactionModel.find().lean()).map((t) => t.externalId).sort();
    assert.deepEqual(externalIds, ["a", "b", "c"]);
  });

  test("o mesmo externalId em usuários diferentes é permitido (o índice é por usuário)", async () => {
    await transactionsRepository.inserirImportadas([importada("ana", "x")]);
    const entraram = await transactionsRepository.inserirImportadas([importada("beto", "x")]);
    assert.equal(entraram, 1);
    assert.equal(await TransactionModel.countDocuments({ externalId: "x" }), 2);
  });

  test("transações manuais (sem externalId) não colidem entre si: o índice é parcial", async () => {
    const manual: TransactionDocument = { ...importada("ana", "n"), origem: "manual", externalId: undefined };
    await TransactionModel.create(manual);
    await TransactionModel.create(manual);
    assert.equal(await TransactionModel.countDocuments({ userId: "ana", origem: "manual" }), 2);
  });

  // Comportamento ATUAL, registrado de propósito: com `ordered: false` o Mongoose pula o documento que o schema recusa
  // em vez de lançar erro, e ele não entra na contagem. Hoje isso não acontece na prática porque o mapeador da Pluggy
  // valida antes (e conta em `ignoradas.invalidas`). Se um dia o repositório passar a lançar, este teste avisa.
  test("documento que o schema recusa é pulado sem derrubar os válidos (e não entra na contagem)", async () => {
    const invalida = { ...importada("ana", "z"), tipo: "transferencia" } as unknown as TransactionDocument;
    const entraram = await transactionsRepository.inserirImportadas([importada("ana", "a"), invalida, importada("ana", "b")]);

    assert.equal(entraram, 2);
    const externalIds = (await TransactionModel.find().lean()).map((t) => t.externalId).sort();
    assert.deepEqual(externalIds, ["a", "b"]);
  });
});

describe("transactionsRepository.externalIdsExistentes", () => {
  test("devolve, dos ids pedidos, os que o usuário já importou", async () => {
    await transactionsRepository.inserirImportadas([importada("ana", "a"), importada("ana", "b")]);
    const existentes = await transactionsRepository.externalIdsExistentes("ana", ["a", "b", "c"]);
    assert.deepEqual([...existentes].sort(), ["a", "b"]);
  });

  test("não enxerga o que é de outro usuário", async () => {
    await transactionsRepository.inserirImportadas([importada("beto", "a")]);
    assert.equal((await transactionsRepository.externalIdsExistentes("ana", ["a"])).size, 0);
  });

  test("lista vazia: devolve um conjunto vazio", async () => {
    assert.equal((await transactionsRepository.externalIdsExistentes("ana", [])).size, 0);
  });
});
