// src/middlewares/rate-limit.middleware.ts
// Limite de tentativas por janela de tempo, para as rotas que um atacante repetiria em massa: login e código MFA
// (adivinhar a senha ou os 6 dígitos), cadastro e recuperação de senha (disparar e-mails) e o chat do Mentor IA (gastar
// a cota da API de IA). Passou do limite: 429 TOO_MANY_REQUESTS, com o cabeçalho Retry-After (segundos).
//
// As contagens ficam na memória do processo: valem para um Backend só e zeram quando ele reinicia. Atrás de um proxy
// (Nginx, Render...), configure app.set("trust proxy", ...) para req.ip ser o IP do usuário e não o do proxy.
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/app-error";
import type { AuthenticatedRequest } from "./auth.middleware";

interface OpcoesDoLimite {
  nome: string; // separa as contagens de cada limitador
  janelaMs: number;
  maximo: number;
  // De quem é a tentativa (IP, e-mail, usuário). undefined: o pedido não entra neste limite.
  chave: (req: Request) => string | undefined;
  // true: só conta as tentativas recusadas (resposta 4xx). Um login certo não consome o limite.
  soFalhas?: boolean;
  mensagem: string;
}

interface Contagem {
  total: number;
  expiraEm: number;
}

const contagens = new Map<string, Contagem>();

// Tira as janelas vencidas de tempos em tempos, para o Map não crescer para sempre. unref(): não segura o processo.
setInterval(() => {
  const agora = Date.now();
  for (const [chave, contagem] of contagens) {
    if (contagem.expiraEm <= agora) contagens.delete(chave);
  }
}, 60_000).unref();

// Para os testes: começa cada caso sem tentativas anteriores.
export function zerarLimites() {
  contagens.clear();
}

export function limitarTentativas(opcoes: OpcoesDoLimite) {
  return (req: Request, res: Response, next: NextFunction) => {
    const de = opcoes.chave(req);
    if (de === undefined) return next();

    const chave = `${opcoes.nome}:${de}`;
    const agora = Date.now();
    let contagem = contagens.get(chave);
    if (!contagem || contagem.expiraEm <= agora) {
      contagem = { total: 0, expiraEm: agora + opcoes.janelaMs };
      contagens.set(chave, contagem);
    }

    if (contagem.total >= opcoes.maximo) {
      res.setHeader("Retry-After", String(Math.ceil((contagem.expiraEm - agora) / 1000)));
      return next(new AppError(opcoes.mensagem, 429, "TOO_MANY_REQUESTS"));
    }

    // Conta ANTES de responder: vários pedidos simultâneos não passam todos pela mesma brecha.
    contagem.total++;
    if (opcoes.soFalhas) {
      const desta = contagem;
      res.on("finish", () => {
        const recusada = res.statusCode >= 400 && res.statusCode < 500;
        if (!recusada && desta.total > 0) desta.total--;
      });
    }
    next();
  };
}

const MINUTO = 60_000;

const ip = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "sem-ip";
// O mesmo e-mail com outra caixa ou espaços conta como o mesmo (como no cadastro e no login).
const emailDoCorpo = (req: Request) =>
  typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : undefined;

export const limites = {
  // Senha: por IP e e-mail, para um atacante não travar o login da vítima a partir de outro IP.
  login: limitarTentativas({
    nome: "login",
    janelaMs: 15 * MINUTO,
    maximo: 10,
    soFalhas: true,
    chave: (req) => `${ip(req)}|${emailDoCorpo(req) ?? ""}`,
    mensagem: "Muitas tentativas de login. Aguarde alguns minutos e tente de novo.",
  }),
  // Muitos e-mails diferentes a partir do mesmo IP (testar uma senha comum em várias contas).
  loginPorIp: limitarTentativas({
    nome: "login-ip",
    janelaMs: 15 * MINUTO,
    maximo: 50,
    soFalhas: true,
    chave: ip,
    mensagem: "Muitas tentativas de login. Aguarde alguns minutos e tente de novo.",
  }),
  // O código do autenticador tem só 6 dígitos: sem limite, dá para tentar todos.
  loginMfa: limitarTentativas({
    nome: "login-mfa",
    janelaMs: 15 * MINUTO,
    maximo: 10,
    soFalhas: true,
    chave: ip,
    mensagem: "Muitas tentativas do código de verificação. Aguarde alguns minutos e entre de novo.",
  }),
  // Cada cadastro dispara um e-mail de confirmação.
  cadastro: limitarTentativas({
    nome: "cadastro",
    janelaMs: 60 * MINUTO,
    maximo: 10,
    chave: ip,
    mensagem: "Muitos cadastros a partir desta conexão. Tente de novo mais tarde.",
  }),
  // Cada pedido dispara um e-mail: limita por IP (vários e-mails) e por e-mail (encher a caixa de uma pessoa).
  recuperarSenhaPorIp: limitarTentativas({
    nome: "recuperar-ip",
    janelaMs: 60 * MINUTO,
    maximo: 10,
    chave: ip,
    mensagem: "Muitos pedidos de recuperação de senha. Tente de novo mais tarde.",
  }),
  recuperarSenhaPorEmail: limitarTentativas({
    nome: "recuperar-email",
    janelaMs: 15 * MINUTO,
    maximo: 3,
    chave: emailDoCorpo,
    mensagem: "Já enviamos instruções para este e-mail há pouco. Confira a caixa de entrada ou tente de novo em alguns minutos.",
  }),
  // Cada mensagem chama a API de IA, que tem cota por minuto. Depois do authMiddleware: conta por usuário.
  chatMentor: limitarTentativas({
    nome: "chat-mentor",
    janelaMs: MINUTO,
    maximo: 10,
    chave: (req) => (req as AuthenticatedRequest).user?.id,
    mensagem: "Você enviou muitas mensagens em pouco tempo. Aguarde um minuto para continuar a conversa.",
  }),
};
