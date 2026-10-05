# mongo.connection.ts — Conexão com o banco (MongoDB)

## O que deve ter neste arquivo
- Função que conecta o Mongoose/driver do Mongo usando `env.MONGO_URI`.
- Log de sucesso/erro da conexão e encerramento do processo em caso de falha ao conectar.
- Exportar só a função `connectDatabase()` — quem chama é o `server.ts`, na inicialização.
- Não tem queries nem schemas aqui (isso fica nos `*.model.ts` de cada feature).

## Exemplo de implementação

```ts
// src/database/mongo.connection.ts
import mongoose from "mongoose";
import { env } from "../config/env";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log("[database] Conectado ao MongoDB");
  } catch (error) {
    console.error("[database] Falha ao conectar ao MongoDB:", error);
    process.exit(1);
  }
}
```
