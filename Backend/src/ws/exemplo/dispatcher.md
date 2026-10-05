# dispatcher.ts — Registro tipo-de-mensagem -> handler

## O que deve ter neste arquivo
- O equivalente, do lado Frontend↔Backend, ao `HandlerRegistry` do Servidor Java: um mapa único de `tipo` de mensagem para a função que trata aquele tipo.
- Dois tipos de registro:
  - `registrarPublico(tipo, handler)`: mensagens que uma conexão **anônima** pode enviar (`Registrar`, `Login`, `Autenticar`). O handler recebe `{ java, autenticar }`, e `autenticar(usuario)` é como o `Login`/`Autenticar` marca a conexão como autenticada.
  - `registrar(tipo, handler)`: mensagens que **exigem** usuário autenticado. O handler recebe `{ usuario, java }` com `usuario` garantido (nunca nulo). Se a conexão ainda é anônima, o dispatcher responde `401` sem chamar o handler.
- `java` é o `JavaServerClient` **daquela conexão** (conexão TCP exclusiva do usuário com o Servidor Java).
- Cada módulo registra os seus tipos no próprio `*.handler.ts`; ninguém edita este arquivo além de adicionar o `import` em `server.ts`.

## Exemplo de implementação

```ts
// src/ws/dispatcher.ts
import { UsuarioAutenticado } from "./ws-auth";
import { JavaServerClient } from "../java-client/java-server.client";
import { AppError } from "../shared/errors/app-error";

export interface ContextoPublico {
  java: JavaServerClient;
  autenticar: (usuario: UsuarioAutenticado) => void;
}

export interface ContextoDaConexao {
  usuario: UsuarioAutenticado;
  java: JavaServerClient;
}

type HandlerPublico = (dados: unknown, contexto: ContextoPublico) => Promise<unknown>;
type Handler = (dados: unknown, contexto: ContextoDaConexao) => Promise<unknown>;

type Entrada =
  | { publico: true; handler: HandlerPublico }
  | { publico: false; handler: Handler };

const handlers = new Map<string, Entrada>();

function adicionar(tipo: string, entrada: Entrada) {
  if (handlers.has(tipo)) {
    throw new Error(`Já existe handler registrado para o tipo "${tipo}"`);
  }
  handlers.set(tipo, entrada);
}

export const dispatcher = {
  registrarPublico(tipo: string, handler: HandlerPublico) {
    adicionar(tipo, { publico: true, handler });
  },

  registrar(tipo: string, handler: Handler) {
    adicionar(tipo, { publico: false, handler });
  },

  async despachar(
    tipo: string,
    dados: unknown,
    conexao: {
      usuario: UsuarioAutenticado | null;
      java: JavaServerClient;
      autenticar: (usuario: UsuarioAutenticado) => void;
    }
  ) {
    const entrada = handlers.get(tipo);
    if (!entrada) {
      throw new Error(`Nenhum handler registrado para o tipo "${tipo}"`);
    }

    if (entrada.publico) {
      return entrada.handler(dados, { java: conexao.java, autenticar: conexao.autenticar });
    }

    if (!conexao.usuario) {
      throw new AppError("Não autenticado", 401, "UNAUTHENTICATED");
    }
    return entrada.handler(dados, { usuario: conexao.usuario, java: conexao.java });
  },
};
```
