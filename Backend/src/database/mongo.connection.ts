// src/database/mongo.connection.ts
import mongoose from "mongoose";
import { env } from "../config/env";

// Conecta no MongoDB (Atlas). Devolve false se MONGO_URI não está definida (o Backend
// segue sem banco); se está definida e a conexão falha, lança erro e o server.ts encerra.
export async function connectDatabase(): Promise<boolean> {
  if (!env.MONGO_URI) {
    return false;
  }

  try {
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.MONGO_DB,
      serverSelectionTimeoutMS: 8000,
    });
  } catch (erro) {
    // a mensagem do driver pode repetir a URI (com a senha): mostramos só o tipo
    const tipo = erro instanceof Error ? erro.name : "erro desconhecido";
    throw new Error(
      `falha ao conectar no MongoDB (${tipo}); confira MONGO_URI, usuário/senha e o IP liberado no Atlas`
    );
  }

  return true;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
