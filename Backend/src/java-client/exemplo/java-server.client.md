# java-server.client.ts — Porta de Cliente.java (uma conexão por usuário)

## O que deve ter neste arquivo
- Equivalente ao `Cliente.java` do professor: abre o `Socket`, embrulha num `Parceiro` e fala com o Servidor. A diferença é que não há `main()` nem teclado — é uma **classe instanciada uma vez por conexão WebSocket do Frontend** (em `ws/connection.ts`), e não um singleton. Cada usuário conectado tem o seu `JavaServerClient`, com a sua própria conexão TCP e, portanto, a sua própria `Supervisora` lá no Servidor Java.
- `JavaServerClient.conectar()`: abre a conexão (falha com erro `503` se o servidor não estiver no ar — o "Indique o servidor e a porta corretos!" do vídeo).
- `enviarPedido(tipoPedido, tipoResposta, dados)`: faz o que o `Cliente.java` fazia na opção "=" (`servidor.receba(pedido)` e esperar a resposta), de forma genérica. A resposta é casada **por ordem de chegada** (fila FIFO): o Servidor Java trata uma conexão sequencialmente (lê um pedido, responde, lê o próximo), então a primeira resposta é sempre do primeiro pedido pendente. Por isso não há ID. Só use `enviarPedido` para pedidos que **têm** resposta.
- Uma única tarefa de leitura (`lerMensagens`) consome tudo que chega. Se for `ComunicadoDeDesligamento`, dispara o callback registrado com `aoDesligar` (o papel da `TratadoraDeComunicadoDeDesligamento`). Qualquer outra mensagem resolve o pedido pendente.
- `sair()`: envia `PedidoParaSair` e chama `adeus()`, como o `Cliente.java` faz ao terminar. Deve ser chamado quando o WebSocket do Frontend fecha.
- Queda abrupta do servidor: o `Parceiro` avisa pelo `aoFechar`; os pedidos pendentes são rejeitados com erro `503` ("Erro de comunicação com o servidor").

## Exemplo de implementação

```ts
// src/java-client/java-server.client.ts
import net from "net";
import { env } from "../config/env";
import { Parceiro } from "./parceiro";
import { TIPO_PEDIDO_PARA_SAIR, ehComunicadoDeDesligamento } from "./comunicado";
import { AppError } from "../shared/errors/app-error";

interface Pendente {
  tipoResposta: string;
  resolve: (dados: any) => void;
  reject: (erro: Error) => void;
}

const erroDeComunicacao = () =>
  new AppError("Erro de comunicação com o servidor", 503, "JAVA_SERVER_UNAVAILABLE");

export class JavaServerClient {
  private pendentes: Pendente[] = [];
  private aoDesligarCallback: (() => void) | null = null;

  private constructor(private readonly parceiro: Parceiro) {
    this.parceiro.aoFechar(() => this.rejeitarPendentes());
    void this.lerMensagens();
  }

  static conectar(): Promise<JavaServerClient> {
    return new Promise((resolve, reject) => {
      const conexao = net.createConnection(
        { host: env.JAVA_SERVER_HOST, port: env.JAVA_SERVER_PORT },
        () => resolve(new JavaServerClient(new Parceiro(conexao)))
      );
      conexao.once("error", () =>
        reject(new AppError("Servidor indisponível", 503, "JAVA_SERVER_UNAVAILABLE"))
      );
    });
  }

  aoDesligar(callback: () => void) {
    this.aoDesligarCallback = callback;
  }

  // Única leitora do Parceiro desta conexão.
  private async lerMensagens() {
    try {
      for (;;) {
        const comunicado = await this.parceiro.envie();

        if (ehComunicadoDeDesligamento(comunicado)) {
          this.aoDesligarCallback?.();
          continue;
        }

        const pendente = this.pendentes.shift();
        if (!pendente) continue;

        if (comunicado.tipo === pendente.tipoResposta) {
          pendente.resolve(comunicado.dados);
        } else {
          pendente.reject(erroDeComunicacao());
        }
      }
    } catch {
      // conexão fechada: o aoFechar já rejeitou os pedidos pendentes
    }
  }

  private rejeitarPendentes() {
    this.pendentes.splice(0).forEach((p) => p.reject(erroDeComunicacao()));
  }

  enviarPedido<TDados, TResposta>(
    tipoPedido: string,
    tipoResposta: string,
    dados: TDados
  ): Promise<TResposta> {
    return new Promise((resolve, reject) => {
      this.pendentes.push({ tipoResposta, resolve, reject });
      try {
        this.parceiro.receba({ tipo: tipoPedido, dados });
      } catch {
        this.pendentes.pop();
        reject(erroDeComunicacao());
      }
    });
  }

  sair() {
    try {
      this.parceiro.receba({ tipo: TIPO_PEDIDO_PARA_SAIR, dados: {} });
    } catch {
      // servidor já caiu: nada a avisar
    }
    this.parceiro.adeus();
  }
}
```
