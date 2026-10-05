# server.ts — Ponto de entrada (bootstrap da aplicação)

## O que deve ter neste arquivo
- Função `bootstrap()` que, em ordem: conecta o banco (`connectDatabase`), registra os handlers de cada módulo (os `import`s abaixo são o que efetivamente chama `dispatcher.registrar(...)` de cada feature) e sobe o `WebSocketServer` na porta `env.PORT`.
- **Não conecta no Servidor Java aqui.** A conexão com o Java é aberta por usuário, em `connection.ts`, quando cada WebSocket é aceito.
- É o único arquivo que sabe que o transporte com o Frontend é WebSocket — se um dia precisar trocar de biblioteca, a mudança fica concentrada aqui e em `connection.ts`.
- Se o banco não conectar, o processo não deve subir "pela metade".

## Exemplo de implementação

```ts
// src/ws/server.ts
import { WebSocketServer } from "ws";
import { env } from "../config/env";
import { connectDatabase } from "../database/mongo.connection";
import { lidarComNovaConexao } from "./connection";

// cada import abaixo dispara o dispatcher.registrar(...) daquele módulo
import "../modules/auth/auth.handler";
import "../modules/auth/mfa/mfa.handler";
import "../modules/transactions/transactions.handler";
import "../modules/dashboard/dashboard.handler";
import "../modules/mentor-ia/mentor-ia.handler";
import "../modules/goals/goals.handler";
import "../modules/investments/investments.handler";

async function bootstrap() {
  await connectDatabase();

  const wss = new WebSocketServer({ port: env.PORT });
  wss.on("connection", lidarComNovaConexao);

  console.log(`[server] Backend (WebSocket) rodando na porta ${env.PORT}`);
}

bootstrap().catch((error) => {
  console.error("[server] Falha ao iniciar a aplicação:", error);
  process.exit(1);
});
```
