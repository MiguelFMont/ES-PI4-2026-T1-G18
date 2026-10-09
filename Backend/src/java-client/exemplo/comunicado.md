# comunicado.ts — Envelope-base das mensagens do protocolo

## O que deve ter neste arquivo
- A base de tudo que viaja entre o Backend e o Servidor Java. No material do professor (`Comunicado.java`), essa classe só precisa existir (`implements Serializable, Cloneable`) porque o Java serializa o objeto inteiro pela rede.
- Como o Node não fala o `ObjectOutputStream`/`ObjectInputStream` nativo do Java, a nossa adaptação troca a serialização nativa por um envelope JSON simples: `{ tipo, dados }`. O `tipo` faz o papel do `instanceof` do professor (`comunicado instanceof PedidoDeOperacao`): Backend e Servidor Java concordam no nome da string em vez do nome da classe.
- **Não há ID de correlação.** Cada conexão do pool atende **um pedido por vez** (envia o pedido, lê a resposta) e só volta ao pool depois; pedidos simultâneos usam conexões diferentes, então respostas de requisições simultâneas nunca se misturam.
- Os tipos de mensagem de cada feature (equivalentes a `PedidoDeOperacao`, `PedidoDeResultado`, `Resultado`...) são só strings acordadas no Sprint 0 (ex.: `"PedidoHashSenha"` / `"RespostaHashSenha"`). Ficam declaradas no próprio `service` que as usa.
- Declara as duas mensagens de controle que existem no exemplo do professor: `PedidoParaSair` (cliente → servidor, ao encerrar) e `ComunicadoDeDesligamento` (servidor → cliente, aviso não solicitado).

## Exemplo de implementação

```ts
// src/java-client/comunicado.ts

// Equivalente ao "Comunicado implements Serializable, Cloneable" do professor:
// aqui é só o formato do envelope, não uma classe para estender.
export interface Comunicado<TDados = unknown> {
  tipo: string;
  dados: TDados;
}

// Equivalente ao PedidoParaSair.java: o cliente avisa que vai encerrar.
export const TIPO_PEDIDO_PARA_SAIR = "PedidoParaSair";

// Equivalente ao ComunicadoDeDesligamento.java: aviso não solicitado do servidor.
export const TIPO_COMUNICADO_DESLIGAMENTO = "ComunicadoDeDesligamento";

// Resposta do servidor quando um handler falha ou o tipo do pedido é desconhecido.
export const TIPO_ERRO = "Erro";

export function ehComunicadoDeDesligamento(comunicado: Comunicado): boolean {
  return comunicado.tipo === TIPO_COMUNICADO_DESLIGAMENTO;
}
```
