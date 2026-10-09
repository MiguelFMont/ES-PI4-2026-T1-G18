# java-server.client.ts — Porta de Cliente.java (pool de conexões duradouras)

## O que deve ter neste arquivo
- Equivalente ao `Cliente.java` do professor: abre o `Socket` (`net.createConnection`), embrulha num `Parceiro` e fala com o Servidor. Como o professor, o cliente **fica conectado** durante a sessão; como o Backend atende várias requisições HTTP ao mesmo tempo, ele mantém um **pool** (`JAVA_SERVER_POOL_SIZE`, padrão 5) de conexões duradouras, cada uma com a sua `Supervisora` no Servidor.
- Cada conexão atende **um pedido por vez** (`receba(pedido)` e depois lê a resposta) e volta ao pool. Pedidos simultâneos usam conexões diferentes; se todas estão ocupadas, o pedido espera uma livre. Por isso não há ID de correlação nem fila de respostas.
- Cada conexão tem um laço de leitura que recebe tudo o que o Servidor manda, inclusive o `ComunicadoDeDesligamento` fora de um pedido (a "thread de comunicado de desligamento" do cliente do professor): a conexão sai do pool e os pedidos em andamento falham com `503 JAVA_SERVER_SHUTTING_DOWN`.
- Expõe `enviarPedido(tipoPedido, tipoResposta, dados)` para os `services` e `fechar()` para o `server.ts` (manda `PedidoParaSair` em cada conexão ao encerrar o Backend).
- **Reconexão automática:** conexão que cai (Servidor reiniciou ou fechou a conexão ociosa) sai do pool; o pedido seguinte abre outra. Se a conexão cair no meio de um pedido, ele é repetido **uma vez** (seguro: as operações do Servidor são puras).
- Valida a resposta: se vier `Erro`, lança `AppError` com o `code` e a `message` do Servidor e o **status HTTP buscado na tabela** `statusDoCodigo` (`shared/errors/error-codes.ts`); `code` fora da tabela vira `502 JAVA_SERVER_ERROR`; tipo de resposta inesperado também.
- Tem **timeout** (`JAVA_SERVER_TIMEOUT_MS`): se o Servidor não responder, a chamada falha com `503` e a conexão é descartada (uma resposta tardia desalinharia o pedido seguinte). Servidor fora do ar (conexão recusada) também vira `503`.
- Não tem regra de negócio, só fala o protocolo. Só use `enviarPedido` para pedidos que **têm** resposta.

## Exemplo de implementação

```ts
// src/java-client/java-server.client.ts
import net from "net";
import { env } from "../config/env";
import { Parceiro } from "./parceiro";
import {
  Comunicado,
  TIPO_ERRO,
  TIPO_PEDIDO_PARA_SAIR,
  ehComunicadoDeDesligamento,
} from "./comunicado";
import { AppError } from "../shared/errors/app-error";
import { statusDoCodigo } from "../shared/errors/error-codes";

const indisponivel = () =>
  new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE");
const desligando = () =>
  new AppError("Servidor desligando", 503, "JAVA_SERVER_SHUTTING_DOWN");

// A conexão caiu antes de a resposta chegar. Como as operações do Servidor são puras
// (dados de entrada -> resultado), o pedido pode ser repetido uma vez com segurança.
class FalhaDeTransporte extends Error {}

// Uma conexão duradoura com o Servidor Java. Atende UM pedido por vez (envia o pedido e
// espera a resposta), por isso não precisa de ID de correlação. Um laço de leitura recebe
// tudo o que o Servidor manda, inclusive o ComunicadoDeDesligamento fora de um pedido
// (a "thread do comunicado de desligamento" do cliente do professor).
class Conexao {
  readonly parceiro: Parceiro;
  ocupada = false;
  morta = false;
  private pendente: { resolve: (c: Comunicado) => void; reject: (e: Error) => void } | null = null;

  constructor(socket: net.Socket, private readonly aoMorrer: () => void) {
    this.parceiro = new Parceiro(socket);
    this.parceiro.aoFechar(() => this.morrer());
    this.ler();
  }

  private async ler() {
    try {
      for (;;) {
        const comunicado = await this.parceiro.envie();
        if (ehComunicadoDeDesligamento(comunicado)) {
          this.morrer(desligando());
          return;
        }
        const p = this.pendente;
        this.pendente = null;
        p?.resolve(comunicado);
      }
    } catch {
      this.morrer();
    }
  }

  enviar(pedido: Comunicado): Promise<Comunicado> {
    return new Promise((resolve, reject) => {
      if (this.morta) {
        reject(new FalhaDeTransporte());
        return;
      }
      this.pendente = { resolve, reject };
      try {
        this.parceiro.receba(pedido);
      } catch {
        this.morrer();
      }
    });
  }

  morrer(erro: Error = new FalhaDeTransporte()) {
    if (this.morta) return;
    this.morta = true;
    this.pendente?.reject(erro);
    this.pendente = null;
    try {
      this.parceiro.adeus();
    } catch {
      // já estava fechada
    }
    this.aoMorrer();
  }
}

const pool: Conexao[] = [];
let criando = 0;
const esperando: Array<() => void> = [];

function acordar() {
  esperando.shift()?.();
}

function conectar(): Promise<Conexao> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      { host: env.JAVA_SERVER_HOST, port: env.JAVA_SERVER_PORT },
      () => {
        socket.removeListener("error", falhou);
        resolve(new Conexao(socket, acordar));
      }
    );
    const falhou = () => reject(indisponivel());
    socket.once("error", falhou);
  });
}

// Pega uma conexão livre do pool; se não há e o pool ainda não está cheio, abre uma nova;
// senão espera alguém devolver. Pedidos simultâneos usam conexões diferentes (cada uma
// com a sua Supervisora no Servidor).
async function obter(): Promise<Conexao> {
  for (;;) {
    for (let i = pool.length - 1; i >= 0; i--) {
      if (pool[i].morta) pool.splice(i, 1);
    }

    const livre = pool.find((c) => !c.ocupada);
    if (livre) {
      livre.ocupada = true;
      return livre;
    }

    if (pool.length + criando < env.JAVA_SERVER_POOL_SIZE) {
      criando++;
      try {
        const nova = await conectar();
        nova.ocupada = true;
        pool.push(nova);
        return nova;
      } finally {
        criando--;
        acordar();
      }
    }

    await new Promise<void>((resolve) => esperando.push(resolve));
  }
}

function devolver(c: Conexao) {
  c.ocupada = false;
  acordar();
}

function comTimeout<T>(promessa: Promise<T>, ms: number, aoEstourar: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      aoEstourar();
      reject(indisponivel());
    }, ms);
    promessa.then(
      (valor) => { clearTimeout(timer); resolve(valor); },
      (erro) => { clearTimeout(timer); reject(erro); }
    );
  });
}

async function tentar(pedido: Comunicado, tentativa: number): Promise<Comunicado> {
  const conexao = await obter();
  try {
    // se estourar o tempo, a conexão é descartada: uma resposta tardia desalinharia o pedido seguinte
    return await comTimeout(conexao.enviar(pedido), env.JAVA_SERVER_TIMEOUT_MS, () => conexao.morrer());
  } catch (erro) {
    if (erro instanceof FalhaDeTransporte) {
      if (tentativa === 1) return tentar(pedido, 2);
      throw indisponivel();
    }
    throw erro;
  } finally {
    devolver(conexao);
  }
}

export const javaServerClient = {
  async enviarPedido<TDados, TResposta>(
    tipoPedido: string,
    tipoResposta: string,
    dados: TDados
  ): Promise<TResposta> {
    const resposta = await tentar({ tipo: tipoPedido, dados }, 1);

    if (resposta.tipo === TIPO_ERRO) {
      const { code, message } = resposta.dados as { code?: string; message?: string };
      const status = code ? statusDoCodigo(code) : undefined;
      if (!code || status === undefined) {
        throw new AppError("Erro desconhecido do servidor", 502, "JAVA_SERVER_ERROR");
      }
      throw new AppError(message ?? "Erro no servidor", status, code);
    }
    if (resposta.tipo !== tipoResposta) {
      throw new AppError("Resposta inesperada do servidor", 502, "JAVA_SERVER_ERROR");
    }

    return resposta.dados as TResposta;
  },

  // Ao encerrar o Backend: PedidoParaSair em cada conexão (o Servidor a remove da lista usuarios).
  fechar() {
    for (const c of pool.splice(0)) {
      try {
        c.parceiro.receba({ tipo: TIPO_PEDIDO_PARA_SAIR, dados: {} });
      } catch {
        // conexão já caiu
      }
      c.morrer();
    }
  },
};
```
