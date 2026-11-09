// src/modules/mentor-ia/__tests__/mentor-ia.repository.test.ts
// O repository contra um MongoDB em memória.
import "./ambiente";
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mentorIaRepository } from "../mentor-ia.repository";
import { ChatMessageModel } from "../mentor-ia.model";
import { encerrarBanco, iniciarBanco, limparBanco } from "./banco-de-teste";

before(iniciarBanco);
after(encerrarBanco);
beforeEach(limparBanco);

// grava `n` trocas (pergunta i / resposta i) para o usuário
async function conversar(userId: string, n: number) {
  for (let i = 1; i <= n; i++) {
    await mentorIaRepository.saveExchange(userId, `pergunta ${i}`, `resposta ${i}`);
  }
}

describe("mentorIaRepository.saveExchange", () => {
  test("grava a pergunta e a resposta juntas, nessa ordem", async () => {
    const [pergunta, resposta] = await mentorIaRepository.saveExchange("u1", "Quanto gastei?", "R$ 1.400,00.");

    assert.equal(pergunta.autor, "usuario");
    assert.equal(pergunta.texto, "Quanto gastei?");
    assert.equal(pergunta.userId, "u1");
    assert.equal(resposta.autor, "ia");
    assert.equal(resposta.texto, "R$ 1.400,00.");
    assert.equal(resposta.userId, "u1");
    assert.ok(pergunta.createdAt instanceof Date);
    assert.ok(pergunta._id.toString() < resposta._id.toString(), "a pergunta vem antes pelo _id");

    assert.equal(await ChatMessageModel.countDocuments({ userId: "u1" }), 2);
  });
});

describe("mentorIaRepository.findRecent", () => {
  test("devolve as N mais recentes, da mais antiga para a mais nova", async () => {
    await conversar("u1", 4);

    const ultimas = await mentorIaRepository.findRecent("u1", 3);
    assert.deepEqual(
      ultimas.map((m) => m.texto),
      ["resposta 3", "pergunta 4", "resposta 4"]
    );

    const todas = await mentorIaRepository.findRecent("u1", 50);
    assert.deepEqual(
      todas.map((m) => `${m.autor}: ${m.texto}`),
      [1, 2, 3, 4].flatMap((i) => [`usuario: pergunta ${i}`, `ia: resposta ${i}`])
    );
  });

  test("usa createdAt antes do _id: mensagem mais antiga no tempo fica antes", async () => {
    await conversar("u1", 1);
    // uma mensagem com _id mais novo, mas de um dia antes
    await ChatMessageModel.collection.insertOne({
      userId: "u1",
      autor: "usuario",
      texto: "antiga",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const mensagens = await mentorIaRepository.findRecent("u1", 50);
    assert.deepEqual(
      mensagens.map((m) => m.texto),
      ["antiga", "pergunta 1", "resposta 1"]
    );
  });

  test("isola por userId: um usuário nunca vê mensagens de outro", async () => {
    await conversar("u1", 2);
    await conversar("u2", 3);

    const doU1 = await mentorIaRepository.findRecent("u1", 50);
    assert.equal(doU1.length, 4);
    assert.ok(doU1.every((m) => m.userId === "u1"));

    assert.equal((await mentorIaRepository.findRecent("u2", 50)).length, 6);
    assert.deepEqual(await mentorIaRepository.findRecent("sem-conversa", 50), []);
  });
});
