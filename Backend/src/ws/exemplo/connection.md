# connection.ts — Ciclo de vida de uma conexão de Frontend

## O que deve ter neste arquivo
- Equivalente à `SupervisoraDeConexao` do professor, do lado Frontend↔Backend: uma instância por conexão aceita. A conexão **nasce anônima** e **abre a conexão exclusiva do usuário com o Servidor Java** (`JavaServerClient.conectar()`).
- Guarda o estado da conexão, como a `Supervisora` guardava o `valor`: `usuario` (começa `null`) e a função `autenticar(usuario)`, entregue aos handlers públicos (`Login`, `Autenticar`) para marcar a conexão como autenticada. A autenticação vale só para esta conexão.
- Entra num loop recebendo mensagens e despacha cada uma pelo `dispatcher.ts`. O dispatcher decide se o tipo é público ou exige usuário autenticado.
- Formato de mensagem com o Frontend (JSON): `{ tipo, dados }` na entrada e na saída, ou `{ tipo: "Erro", dados: { message, code } }`.
- Se o Servidor Java não estiver no ar, fecha o WebSocket (código `1011`).
- Se o Servidor Java avisar que vai desligar (`ComunicadoDeDesligamento`), repassa `{ tipo: "ServidorDesligando" }` e fecha a conexão.
- Ao fechar o WebSocket (`close`), chama `java.sair()` (`PedidoParaSair` + `adeus()`).
- Erros: `AppError` vira `{ tipo: "Erro", dados: { message, code } }`; qualquer outro erro é logado e vira um erro genérico.
- A conexão com o Java é uma `Promise` (`javaPronto`) criada logo no início: o listener de `message` já fica registrado e espera por ela, para não perder mensagens enviadas enquanto o Backend ainda conecta.

## Exemplo de implementação

```ts
// src/ws/connection.ts
import { WebSocket } from "ws";
import { dispatcher } from "./dispatcher";
import { UsuarioAutenticado } from "./ws-auth";
import { JavaServerClient } from "../java-client/java-server.client";
import { AppError } from "../shared/errors/app-error";

const enviar = (socket: WebSocket, tipo: string, dados: unknown) =>
  socket.send(JSON.stringify({ tipo, dados }));

export function lidarComNovaConexao(socket: WebSocket) {
  // estado desta conexão (equivalente ao "valor" da Supervisora do professor)
  let usuario: UsuarioAutenticado | null = null;
  const autenticar = (u: UsuarioAutenticado) => {
    usuario = u;
  };

  const javaPronto = JavaServerClient.conectar();

  javaPronto
    .then((java) =>
      java.aoDesligar(() => {
        enviar(socket, "ServidorDesligando", { message: "Volte mais tarde" });
        socket.close(1001, "Servidor Java desligando");
      })
    )
    .catch(() => socket.close(1011, "Servidor indisponível"));

  console.log("[ws] Nova conexão (anônima)");

  socket.on("message", async (raw) => {
    let mensagem: { tipo: string; dados: unknown };
    try {
      mensagem = JSON.parse(raw.toString());
    } catch {
      enviar(socket, "Erro", { message: "JSON inválido" });
      return;
    }

    try {
      const java = await javaPronto;
      const resultado = await dispatcher.despachar(mensagem.tipo, mensagem.dados, {
        usuario,
        java,
        autenticar,
      });
      enviar(socket, mensagem.tipo, resultado);
    } catch (erro) {
      if (erro instanceof AppError) {
        enviar(socket, "Erro", { message: erro.message, code: erro.code });
        return;
      }
      console.error("[ws] Erro não tratado:", erro);
      enviar(socket, "Erro", { message: "Erro interno do servidor" });
    }
  });

  socket.on("close", () => {
    console.log(`[ws] Conexão encerrada: ${usuario?.email ?? "anônima"}`);
    javaPronto.then((java) => java.sair()).catch(() => {});
  });
}
```
