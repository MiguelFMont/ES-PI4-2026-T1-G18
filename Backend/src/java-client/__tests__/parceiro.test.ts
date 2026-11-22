// src/java-client/__tests__/parceiro.test.ts
// Leitura das mensagens do Servidor Java pelo Parceiro, com um socket simulado (sem rede).
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type net from "node:net";
import { Parceiro } from "../parceiro";

// Só o que o Parceiro usa do net.Socket: eventos, write, end e destroy.
function socketSimulado() {
  const socket = new EventEmitter() as EventEmitter & { write: () => boolean; end: () => void; destroy: () => void };
  socket.write = () => true;
  socket.end = () => {};
  socket.destroy = () => socket.emit("close");
  return socket;
}

describe("Parceiro: mensagens recebidas em pedaços", () => {
  test("um caractere de vários bytes (ç, ã, é) cortado entre dois pedaços chega inteiro", async () => {
    const socket = socketSimulado();
    const parceiro = new Parceiro(socket as unknown as net.Socket);
    const texto = "Alimentação: média diária R$ 12,50 — ótimo";
    const bytes = Buffer.from(JSON.stringify({ tipo: "Resposta", dados: { texto } }) + "\n", "utf8");

    // corta no meio do primeiro caractere de 2 bytes (o "ç")
    const corte = bytes.indexOf(Buffer.from("ç", "utf8")) + 1;
    socket.emit("data", bytes.subarray(0, corte));
    socket.emit("data", bytes.subarray(corte));

    const comunicado = await parceiro.envie();
    assert.deepEqual(comunicado, { tipo: "Resposta", dados: { texto } });
  });

  test("um byte por pedaço: a mensagem inteira continua certa", async () => {
    const socket = socketSimulado();
    const parceiro = new Parceiro(socket as unknown as net.Socket);
    const bytes = Buffer.from('{"tipo":"Eco","dados":{"oi":"ação é ü"}}\n', "utf8");

    for (const byte of bytes) socket.emit("data", Buffer.from([byte]));

    assert.deepEqual(await parceiro.envie(), { tipo: "Eco", dados: { oi: "ação é ü" } });
  });

  test("duas mensagens no mesmo pedaço saem na ordem", async () => {
    const socket = socketSimulado();
    const parceiro = new Parceiro(socket as unknown as net.Socket);

    socket.emit("data", Buffer.from('{"tipo":"A","dados":{}}\n{"tipo":"B","dados":{}}\n', "utf8"));

    assert.equal((await parceiro.envie()).tipo, "A");
    assert.equal((await parceiro.envie()).tipo, "B");
  });
});
