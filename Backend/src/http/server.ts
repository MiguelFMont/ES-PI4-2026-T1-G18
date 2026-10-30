// src/http/server.ts
import { app } from "./app";
import { env } from "../config/env";
import { connectDatabase, disconnectDatabase } from "../database/mongo.connection";
import { javaServerClient } from "../java-client/java-server.client";
import { sistemaService } from "../modules/sistema/sistema.service";

// Só avisa no console se o Servidor Java responde; o Backend sobe de qualquer jeito (as rotas que
// dependem dele respondem 503 enquanto ele estiver fora do ar, e o pool reconecta sozinho).
async function avisarSeJavaIndisponivel() {
  const destino = `${env.JAVA_SERVER_HOST}:${env.JAVA_SERVER_PORT}`;
  try {
    await sistemaService.eco({});
    console.log(`[java] Servidor Java disponível em ${destino}`);
  } catch {
    console.warn(`[java] Servidor Java indisponível em ${destino}: as rotas que dependem dele respondem 503 até ele subir`);
  }
}

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
    void avisarSeJavaIndisponivel();
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
