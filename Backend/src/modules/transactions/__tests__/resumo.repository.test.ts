// Gabriel Henrique Pozeti de Faria / R.A 25022716
// src/modules/transactions/__tests__/resumo.repository.test.ts
// A consulta que alimenta o resumo do Mentor IA (o Servidor Java soma a lista inteira): todas as transações do período,
// sem paginação, só do usuário e só com os campos que o resumo usa.
import "./ambiente";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { TransactionDocument, TransactionModel } from "../transactions.model";
import { transactionsRepository } from "../transactions.repository";
import { encerrarBanco, iniciarBanco, limparBanco } from "../../connected-accounts/__tests__/banco";

before(iniciarBanco);
after(encerrarBanco);
beforeEach(limparBanco);

const INICIO = new Date("2026-11-01T03:00:00.000Z");

const transacao = (userId: string, valor: number, data: string, extra: Partial<TransactionDocument> = {}): TransactionDocument => ({
  userId,
  tipo: "despesa",
  valor,
  categoria: "Alimentação",
  data: new Date(data),
  descricao: `gasto ${valor}`,
  observacoes: "anotação pessoal",
  formaPagamento: "pix",
  origem: "manual",
  ...extra,
});

describe("transactionsRepository.findParaResumo", () => {
  test("devolve TODAS as transações do período (mais de 100), sem as de antes nem as de outro usuário", async () => {
    const doMes = Array.from({ length: 150 }, (_, i) => transacao("ana", i + 1, `2026-11-${String((i % 20) + 1).padStart(2, "0")}T12:00:00Z`));
    await TransactionModel.insertMany([
      ...doMes,
      transacao("ana", 999, "2026-10-31T12:00:00Z"), // mês anterior
      transacao("beto", 500, "2026-11-10T12:00:00Z"), // outro usuário
    ]);

    const resultado = await transactionsRepository.findParaResumo("ana", INICIO);

    assert.equal(resultado.length, 150);
    assert.equal(resultado.reduce((soma, t) => soma + t.valor, 0), (150 * 151) / 2);
  });

  test("só os campos do resumo: sem userId, _id, observações nem forma de pagamento", async () => {
    await TransactionModel.create(transacao("ana", 42, "2026-11-05T12:00:00Z", { tipo: "receita", categoria: "Salário" }));

    const [t] = await transactionsRepository.findParaResumo("ana", INICIO);

    assert.deepEqual(Object.keys(t).sort(), ["categoria", "data", "descricao", "tipo", "valor"]);
    assert.deepEqual(
      { ...t, data: t.data.toISOString() },
      { tipo: "receita", valor: 42, categoria: "Salário", descricao: "gasto 42", data: "2026-11-05T12:00:00.000Z" }
    );
  });
});
