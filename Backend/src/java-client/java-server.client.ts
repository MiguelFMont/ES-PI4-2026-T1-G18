// src/java-client/java-server.client.ts
import net from "net";
import { env } from "../config/env";
import { Parceiro } from "./parceiro";
import {
  TIPO_ERRO,
  TIPO_PEDIDO_PARA_SAIR,
  ehComunicadoDeDesligamento,
} from "./comunicado";
import { AppError } from "../shared/errors/app-error";
import { statusDoCodigo } from "../shared/errors/error-codes";

const indisponivel = () =>
  new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE");

function conectar(): Promise<Parceiro> {
  return new Promise((resolve, reject) => {
    const conexao = net.createConnection(
      { host: env.JAVA_SERVER_HOST, port: env.JAVA_SERVER_PORT },
      () => resolve(new Parceiro(conexao))
    );
    conexao.once("error", () => reject(indisponivel()));
  });
}

function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(indisponivel()), ms);
    promessa.then(
      (valor) => { clearTimeout(timer); resolve(valor); },
      (erro) => { clearTimeout(timer); reject(erro); }
    );
  });
}

export const javaServerClient = {
  async enviarPedido<TDados, TResposta>(
    tipoPedido: string,
    tipoResposta: string,
    dados: TDados
  ): Promise<TResposta> {
    const parceiro = await conectar();

    try {
      parceiro.receba({ tipo: tipoPedido, dados });
      const resposta = await comTimeout(parceiro.envie(), env.JAVA_SERVER_TIMEOUT_MS);

      if (resposta.tipo === TIPO_ERRO) {
        const { code, message } = resposta.dados as { code?: string; message?: string };
        const status = code ? statusDoCodigo(code) : undefined;
        if (!code || status === undefined) {
          throw new AppError("Erro desconhecido do servidor", 502, "JAVA_SERVER_ERROR");
        }
        throw new AppError(message ?? "Erro no servidor", status, code);
      }
      if (ehComunicadoDeDesligamento(resposta)) {
        throw new AppError("Servidor desligando", 503, "JAVA_SERVER_SHUTTING_DOWN");
      }
      if (resposta.tipo !== tipoResposta) {
        throw new AppError("Resposta inesperada do servidor", 502, "JAVA_SERVER_ERROR");
      }

      return resposta.dados as TResposta;
    } catch (erro) {
      throw erro instanceof AppError ? erro : indisponivel();
    } finally {
      try {
        parceiro.receba({ tipo: TIPO_PEDIDO_PARA_SAIR, dados: {} });
      } catch {
        // conexão já caiu: nada a avisar
      }
      parceiro.adeus();
    }
  },
};
