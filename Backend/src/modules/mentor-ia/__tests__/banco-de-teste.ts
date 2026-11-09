// src/modules/mentor-ia/__tests__/banco-de-teste.ts
// MongoDB em memória (mongodb-memory-server) para os testes de repository e de rota: nada vai
// para o Atlas. Na primeira execução o pacote baixa o binário do MongoDB (fica em cache).
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let servidor: MongoMemoryServer | undefined;

export async function iniciarBanco() {
  servidor = await MongoMemoryServer.create();
  await mongoose.connect(servidor.getUri(), { dbName: "financeai-teste" });
}

export async function encerrarBanco() {
  await mongoose.disconnect();
  await servidor?.stop();
}

export async function limparBanco() {
  for (const colecao of Object.values(mongoose.connection.collections)) {
    await colecao.deleteMany({});
  }
}
