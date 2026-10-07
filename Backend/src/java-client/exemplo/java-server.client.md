# java-server.client.ts — Porta de Cliente.java (uma conexão por chamada)

## O que deve ter neste arquivo
- Equivalente ao `Cliente.java` do professor: abre o `Socket` (`net.createConnection`), embrulha num `Parceiro` e fala com o Servidor. Como o Backend é uma API HTTP (Express) e HTTP não mantém conexão, cada chamada ao Servidor Java segue o ciclo de vida de um `Cliente` do professor: **conecta, faz um pedido, lê a resposta, envia `PedidoParaSair` e fecha**. Assim cada chamada tem a sua própria `Supervisora` no Servidor, sem ID de correlação e sem compartilhar conexão entre requisições simultâneas.
- Expõe um único método para os `services`: `enviarPedido(tipoPedido, tipoResposta, dados)`. Por baixo faz o que o `Cliente.java` fazia na opção "=": `receba(pedido)` e depois `envie()` para ler a resposta.
- Valida a resposta: se vier `Erro`, lança `AppError` com o `status`, o `code` e a `message` que o Servidor mandou (por exemplo `409 EMAIL_IN_USE`, `401 INVALID_CREDENTIALS`, `404 NOT_FOUND`), já que o Servidor é o dono das regras de negócio e decide o resultado; sem esses campos, usa `502`; se vier `ComunicadoDeDesligamento` (o servidor foi desativado no meio da chamada), lança `AppError` `503`; se o tipo não for o esperado, também falha.
- Tem **timeout** (`JAVA_SERVER_TIMEOUT_MS`): se o Servidor não responder, a chamada falha com `503` em vez de ficar pendurada. Servidor fora do ar (conexão recusada) também vira `503`.
- Não tem regra de negócio, só fala o protocolo. Só use `enviarPedido` para pedidos que **têm** resposta.

## Exemplo de implementação

```ts
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
```
