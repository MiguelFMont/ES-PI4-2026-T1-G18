// src/modules/auth/__tests__/auth.dto.test.ts
// As preferências que o usuário pode salvar em PATCH /auth/me: tema, estilo da interface e ocultar valores.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { atualizarPerfilSchema } from "../auth.dto";

describe("atualizarPerfilSchema: preferências", () => {
  test("aceita o estilo da interface com sombras ou com bordas", () => {
    assert.deepEqual(atualizarPerfilSchema.parse({ preferencias: { estilo: "sombras" } }), { preferencias: { estilo: "sombras" } });
    assert.deepEqual(atualizarPerfilSchema.parse({ preferencias: { estilo: "bordas" } }), { preferencias: { estilo: "bordas" } });
  });

  test("rejeita um estilo desconhecido", () => {
    assert.equal(atualizarPerfilSchema.safeParse({ preferencias: { estilo: "neon" } }).success, false);
  });

  test("aceita tema e estilo juntos", () => {
    const resultado = atualizarPerfilSchema.safeParse({ preferencias: { tema: "escuro", estilo: "bordas" } });
    assert.equal(resultado.success, true);
  });

  test("continua rejeitando campos que não existem", () => {
    assert.equal(atualizarPerfilSchema.safeParse({ preferencias: { fonte: "grande" } }).success, false);
  });
});
