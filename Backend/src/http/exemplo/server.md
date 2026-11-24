# server.ts — Ponto de entrada (bootstrap da aplicação)

## O que deve ter neste arquivo
- Sobe o servidor HTTP com `app.listen(env.PORT)`. É o único arquivo que abre uma porta de rede, por isso fica separado do `app.ts` (que os testes podem importar sem abrir porta).
- **Conecta no MongoDB antes de aceitar requisições** (`connectDatabase()`): se `MONGO_URI` não está definida, avisa e sobe sem banco (útil para testar só o caminho até o Servidor Java); se está definida e a conexão falha, encerra.
- **Não conecta no Servidor Java aqui**: o `java-client` abre as conexões sob demanda (pool) e reconecta sozinho. Se o Servidor estiver fora do ar, as rotas que dependem dele respondem `503`; o próprio Backend sobe normalmente.
- Ao receber `SIGINT`/`SIGTERM`, manda `PedidoParaSair` em cada conexão com o Servidor e fecha o banco, como o cliente do professor faz ao sair.

## Exemplo de implementação

```ts
// src/http/server.ts
import { app } from "./app";
import { env } from "../config/env";
import { connectDatabase, disconnectDatabase } from "../database/mongo.connection";
import { javaServerClient } from "../java-client/java-server.client";

async function iniciar() {
  try {
    if (await connectDatabase()) {
      console.log("[database] Conectado ao MongoDB");
    } else {
      console.warn("[database] MONGO_URI não definida: Backend sem banco (só /v1/health e /v1/eco)");
    }
  } catch (erro) {
    console.error("[database]", erro instanceof Error ? erro.message : erro);
    process.exit(1);
  }

  const servidor = app.listen(env.PORT, () => {
    console.log(`[server] Backend rodando em http://localhost:${env.PORT}/v1`);
  });

  // Ao encerrar, avisa o Servidor Java (PedidoParaSair em cada conexão), como o Cliente do professor.
  const encerrar = async () => {
    servidor.close();
    javaServerClient.fechar();
    await disconnectDatabase().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

iniciar();
```
