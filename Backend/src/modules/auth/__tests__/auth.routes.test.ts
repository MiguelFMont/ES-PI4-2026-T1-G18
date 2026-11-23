// src/modules/auth/__tests__/auth.routes.test.ts
// Cadastro, confirmação de e-mail, login e recuperação de senha de ponta a ponta no Backend: app Express numa porta
// livre, MongoDB em memória, e o Servidor Java (hash e conferência da senha) e o envio de e-mail simulados.
import "./ambiente";
import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../../../http/app";
import { javaServerClient } from "../../../java-client/java-server.client";
import { emailService } from "../../../shared/email/email.service";
import { zerarLimites } from "../../../middlewares/rate-limit.middleware";
import { UserModel } from "../auth.model";
import { PendingRegistrationModel } from "../pending-registration.model";
import { authRepository } from "../auth.repository";
import { encerrarBanco, iniciarBanco, limparBanco } from "../../connected-accounts/__tests__/banco";

let servidor: Server;
let base: string;

const SENHA = "Senha#123";

// CPF válido a partir de 9 dígitos (calcula os 2 dígitos verificadores)
function cpfValido(base9: string): string {
  let cpf = base9;
  for (let tamanho = 9; tamanho < 11; tamanho++) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    cpf += String(resto === 10 ? 0 : resto);
  }
  return cpf;
}
const CPF_1 = cpfValido("529982247");
const CPF_2 = cpfValido("111444777");
const CPF_3 = cpfValido("123456789");

function post(caminho: string, corpo: unknown) {
  return fetch(`${base}/v1/auth${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}
const json = (resposta: Response): Promise<any> => resposta.json();

// O Servidor Java simulado: o "hash" é previsível para o login conferir a senha.
function simularServidorJava() {
  mock.method(javaServerClient, "enviarPedido", async (tipo: string, _resposta: string, dados: any) => {
    if (tipo === "PedidoHashSenha") return { hash: `hash:${dados.senha}` };
    if (tipo === "PedidoValidarSenha") return { valido: dados.hash === `hash:${dados.senha}` };
    throw new Error(`Pedido inesperado ao Servidor Java: ${tipo}`);
  });
}

// Os e-mails não são enviados: os links ficam guardados para o teste "clicar".
let linksDeConfirmacao: string[];
let linksDeRecuperacao: string[];
function simularEmail() {
  linksDeConfirmacao = [];
  linksDeRecuperacao = [];
  mock.method(emailService, "enviarConfirmacaoEmail", async (_email: string, link: string) => {
    linksDeConfirmacao.push(link);
  });
  mock.method(emailService, "enviarRecuperacaoSenha", async (_email: string, link: string) => {
    linksDeRecuperacao.push(link);
  });
}
const tokenDoLink = (link: string) => new URL(link).searchParams.get("token")!;

// Usuário já confirmado, gravado direto no banco (o e-mail fica exatamente como passado).
async function criarUsuario(email: string, cpf: string) {
  return UserModel.create({ nome: "Usuário", email, cpf, senhaHash: `hash:${SENHA}`, emailVerificado: true });
}

before(async () => {
  await iniciarBanco();
  await Promise.all([UserModel.syncIndexes(), PendingRegistrationModel.syncIndexes()]); // e-mail e CPF únicos
  servidor = app.listen(0);
  await once(servidor, "listening");
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => servidor.close(resolve));
  await encerrarBanco();
});

beforeEach(async () => {
  await limparBanco();
  zerarLimites();
  simularServidorJava();
  simularEmail();
});
afterEach(() => mock.restoreAll());

describe("e-mail normalizado", () => {
  test("cadastro com maiúsculas e espaços grava em minúsculas, e o login aceita qualquer caixa", async () => {
    const cadastro = await post("/register", { nome: "Ana", email: "  Ana.Silva@Exemplo.COM ", cpf: CPF_1, senha: SENHA });
    assert.equal(cadastro.status, 201);
    assert.equal((await PendingRegistrationModel.findOne().lean())?.email, "ana.silva@exemplo.com");

    assert.equal((await post("/verify-email", { token: tokenDoLink(linksDeConfirmacao[0]) })).status, 200);
    assert.equal((await UserModel.findOne().lean())?.email, "ana.silva@exemplo.com");

    const login = await post("/login", { email: "ANA.SILVA@exemplo.com", senha: SENHA });
    assert.equal(login.status, 200);
    assert.ok((await json(login)).token);
  });

  test("o mesmo e-mail com outra caixa é 409 EMAIL_IN_USE, inclusive contra conta antiga gravada com maiúsculas", async () => {
    await criarUsuario("Beto@Exemplo.com", CPF_1);

    const repetido = await post("/register", { nome: "Beto 2", email: "beto@exemplo.com", cpf: CPF_2, senha: SENHA });
    assert.equal(repetido.status, 409);
    assert.equal((await json(repetido)).error.code, "EMAIL_IN_USE");

    // a conta antiga continua entrando com o e-mail em minúsculas
    assert.equal((await post("/login", { email: "beto@exemplo.com", senha: SENHA })).status, 200);
  });

  test("recuperar senha encontra a conta com o e-mail em outra caixa", async () => {
    await criarUsuario("carla@exemplo.com", CPF_1);
    assert.equal((await post("/forgot-password", { email: "Carla@Exemplo.com" })).status, 200);
    assert.equal(linksDeRecuperacao.length, 1);
  });
});

describe("CPF repetido", () => {
  test("cadastro com CPF de outra conta: 409 CPF_IN_USE, sem cadastro pendente nem e-mail", async () => {
    await criarUsuario("dono@exemplo.com", CPF_1);

    const resposta = await post("/register", { nome: "Outro", email: "outro@exemplo.com", cpf: CPF_1, senha: SENHA });
    assert.equal(resposta.status, 409);
    assert.deepEqual((await json(resposta)).error, { message: "CPF já cadastrado", code: "CPF_IN_USE" });
    assert.equal(await PendingRegistrationModel.countDocuments(), 0);
    assert.equal(linksDeConfirmacao.length, 0);
  });

  test("dois cadastros pendentes com o mesmo CPF: só o primeiro confirmado vale, o segundo é 409 (não 500)", async () => {
    assert.equal((await post("/register", { nome: "A", email: "a@exemplo.com", cpf: CPF_1, senha: SENHA })).status, 201);
    assert.equal((await post("/register", { nome: "B", email: "b@exemplo.com", cpf: CPF_1, senha: SENHA })).status, 201);

    assert.equal((await post("/verify-email", { token: tokenDoLink(linksDeConfirmacao[0]) })).status, 200);
    const segundo = await post("/verify-email", { token: tokenDoLink(linksDeConfirmacao[1]) });
    assert.equal(segundo.status, 409);
    assert.equal((await json(segundo)).error.code, "CPF_IN_USE");
    assert.equal(await UserModel.countDocuments(), 1);
  });

  test("se as checagens passam ao mesmo tempo e só o índice único do banco percebe: 409 DUPLICATE_KEY", async () => {
    await criarUsuario("dono@exemplo.com", CPF_1);
    assert.equal((await post("/register", { nome: "X", email: "x@exemplo.com", cpf: CPF_2, senha: SENHA })).status, 201);
    // simula a corrida: o CPF do pendente vira o de outra conta depois da checagem do cadastro
    await PendingRegistrationModel.updateOne({}, { cpf: CPF_1 });
    mock.method(authRepository, "findByCpf", async () => null);

    const resposta = await post("/verify-email", { token: tokenDoLink(linksDeConfirmacao[0]) });
    assert.equal(resposta.status, 409);
    assert.equal((await json(resposta)).error.code, "DUPLICATE_KEY");
  });
});

describe("limite de tentativas", () => {
  test("login: 10 senhas erradas bloqueiam o 11º pedido (mesmo com a senha certa), com Retry-After", async () => {
    await criarUsuario("ana@exemplo.com", CPF_1);

    for (let i = 1; i <= 10; i++) {
      const errada = await post("/login", { email: "ana@exemplo.com", senha: `errada${i}` });
      assert.equal(errada.status, 401, `tentativa ${i}`);
    }
    const bloqueada = await post("/login", { email: "ANA@exemplo.com", senha: SENHA });
    assert.equal(bloqueada.status, 429);
    assert.equal((await json(bloqueada)).error.code, "TOO_MANY_REQUESTS");
    assert.ok(Number(bloqueada.headers.get("retry-after")) > 0);

    // o limite é por e-mail: outra conta no mesmo IP continua entrando
    await criarUsuario("beto@exemplo.com", CPF_2);
    assert.equal((await post("/login", { email: "beto@exemplo.com", senha: SENHA })).status, 200);
  });

  test("login: os que dão certo não contam", async () => {
    await criarUsuario("ana@exemplo.com", CPF_1);
    for (let i = 1; i <= 12; i++) {
      assert.equal((await post("/login", { email: "ana@exemplo.com", senha: SENHA })).status, 200, `login ${i}`);
    }
  });

  test("código MFA: 10 tentativas recusadas bloqueiam a 11ª", async () => {
    for (let i = 1; i <= 10; i++) {
      const recusada = await post("/login/mfa", { mfaToken: "token-falso", codigo: "123456" });
      assert.equal(recusada.status, 401, `tentativa ${i}`);
    }
    const bloqueada = await post("/login/mfa", { mfaToken: "token-falso", codigo: "123456" });
    assert.equal(bloqueada.status, 429);
    assert.equal((await json(bloqueada)).error.code, "TOO_MANY_REQUESTS");
  });

  test("recuperar senha: 3 pedidos por e-mail a cada 15 minutos; outro e-mail não é afetado", async () => {
    await criarUsuario("ana@exemplo.com", CPF_1);
    for (let i = 1; i <= 3; i++) {
      assert.equal((await post("/forgot-password", { email: "ana@exemplo.com" })).status, 200, `pedido ${i}`);
    }
    const bloqueado = await post("/forgot-password", { email: " Ana@Exemplo.com" });
    assert.equal(bloqueado.status, 429);
    assert.equal(linksDeRecuperacao.length, 3);

    assert.equal((await post("/forgot-password", { email: "outra@exemplo.com" })).status, 200);
  });

  test("cadastro: 10 pedidos por IP a cada hora", async () => {
    for (let i = 1; i <= 10; i++) {
      assert.equal((await post("/register", { nome: "" })).status, 400, `pedido ${i}`);
    }
    const bloqueado = await post("/register", { nome: "Ana", email: "ana@exemplo.com", cpf: CPF_3, senha: SENHA });
    assert.equal(bloqueado.status, 429);
    assert.equal(linksDeConfirmacao.length, 0);
  });
});
