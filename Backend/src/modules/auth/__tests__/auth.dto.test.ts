// src/modules/auth/__tests__/auth.dto.test.ts
// As preferências que o usuário pode salvar em PATCH /auth/me: tema, estilo da interface e ocultar valores.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { atualizarPerfilSchema, forgotPasswordSchema, loginSchema, registerSchema, senhaSchema } from "../auth.dto";

const mensagensDaSenha = (senha: string) => {
  const resultado = senhaSchema.safeParse(senha);
  return resultado.success ? [] : resultado.error.issues.map((i) => i.message);
};

describe("senhaSchema: regras da senha", () => {
  test("aceita qualquer caractere especial e letras acentuadas", () => {
    for (const senha of ["Senha#123", "minha-Senha1", "Ação_2026x", "Abc.1234", "Pão de queijo 1!", "Senha@123"]) {
      assert.deepEqual(mensagensDaSenha(senha), [], senha);
    }
  });

  test("cada regra que falta tem a própria mensagem, inclusive a da letra minúscula", () => {
    assert.deepEqual(mensagensDaSenha("ABC123!@"), ["A senha deve ter pelo menos uma letra minúscula"]);
    assert.deepEqual(mensagensDaSenha("abc123!@"), ["A senha deve ter pelo menos uma letra maiúscula"]);
    assert.deepEqual(mensagensDaSenha("Abcdefg!"), ["A senha deve ter pelo menos um número"]);
    assert.deepEqual(mensagensDaSenha("Abcdefg1"), ["A senha deve ter pelo menos um caractere especial (ex.: ! @ # $ % - _)"]);
    assert.deepEqual(mensagensDaSenha("Ab1!"), ["A senha deve ter no mínimo 8 caracteres"]);
  });

  test("espaço não conta como caractere especial", () => {
    assert.deepEqual(mensagensDaSenha("Abc 1defgh"), ["A senha deve ter pelo menos um caractere especial (ex.: ! @ # $ % - _)"]);
  });
});

describe("e-mail normalizado (sem espaços nas pontas e em minúsculas)", () => {
  test("no cadastro, no login e na recuperação de senha", () => {
    const cadastro = registerSchema.parse({ nome: "Ana", email: "  Ana.Silva@Exemplo.COM ", cpf: "52998224725", senha: "Senha#123" });
    assert.equal(cadastro.email, "ana.silva@exemplo.com");
    assert.equal(loginSchema.parse({ email: "ANA@X.com", senha: "x" }).email, "ana@x.com");
    assert.equal(forgotPasswordSchema.parse({ email: " Ana@X.com" }).email, "ana@x.com");
  });

  test("e-mail inválido continua recusado, com mensagem em português", () => {
    const resultado = loginSchema.safeParse({ email: "nao-e-email", senha: "x" });
    assert.equal(resultado.success, false);
    assert.deepEqual(resultado.error?.flatten().fieldErrors.email, ["E-mail inválido"]);
  });
});

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
