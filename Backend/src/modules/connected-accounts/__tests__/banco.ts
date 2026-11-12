// src/modules/connected-accounts/__tests__/banco.ts
// Banco dos testes de rota. Por padrão é o MongoDB em memória (como nos testes do Mentor IA): nada vai para o Atlas.
// Se a primeira execução do mongodb-memory-server estiver lenta (ela baixa o binário do MongoDB, uns 700 MB), dá para usar um
// banco isolado qualquer definindo TESTE_MONGO_URI: ele cria um banco com nome único e o apaga no fim.
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { encerrarBanco as encerrarEmMemoria, iniciarBanco as iniciarEmMemoria, limparBanco } from "../../mentor-ia/__tests__/banco-de-teste";

export { limparBanco };

const uriExterna = process.env.TESTE_MONGO_URI;
let nomeDoBanco: string | undefined;

export async function iniciarBanco() {
  if (!uriExterna) return iniciarEmMemoria();
  nomeDoBanco = `financeai_teste_${randomUUID().slice(0, 8)}`;
  await mongoose.connect(uriExterna, { dbName: nomeDoBanco });
}

export async function encerrarBanco() {
  if (!uriExterna) return encerrarEmMemoria();
  await mongoose.connection.dropDatabase(); // só o banco de teste, de nome único
  await mongoose.disconnect();
}
