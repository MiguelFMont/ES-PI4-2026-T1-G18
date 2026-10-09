// src/java-client/parceiro.ts
import net from "net";
import { Comunicado } from "./comunicado";

interface Aguardando {
  resolve: () => void;
  reject: (erro: Error) => void;
}

export class Parceiro {
  private buffer = "";
  private fila: Comunicado[] = [];
  private aguardando: Aguardando[] = [];
  private fechado = false;
  private aoFecharCallback: (() => void) | null = null;

  constructor(private readonly conexao: net.Socket) {
    this.conexao.on("data", (chunk) => this.aoReceberDados(chunk));
    this.conexao.on("close", () => this.aoEncerrar());
    this.conexao.on("error", () => this.aoEncerrar());
  }

  private aoReceberDados(chunk: Buffer) {
    this.buffer += chunk.toString("utf-8");
    const linhas = this.buffer.split("\n");
    this.buffer = linhas.pop() ?? "";

    for (const linha of linhas) {
      if (!linha.trim()) continue;
      try {
        this.fila.push(JSON.parse(linha));
      } catch {
        // linha que não é JSON: o protocolo foi violado, encerra a conexão
        this.conexao.destroy();
        return;
      }
    }
    this.aguardando.splice(0).forEach((a) => a.resolve());
  }

  private aoEncerrar() {
    if (this.fechado) return;
    this.fechado = true;
    this.aguardando.splice(0).forEach((a) => a.reject(new Error("Erro de recepção")));
    this.aoFecharCallback?.();
  }

  private aguardarMensagem(): Promise<void> {
    if (this.fila.length > 0) return Promise.resolve();
    if (this.fechado) return Promise.reject(new Error("Erro de recepção"));
    return new Promise((resolve, reject) => this.aguardando.push({ resolve, reject }));
  }

  aoFechar(callback: () => void) {
    this.aoFecharCallback = callback;
  }

  // receba(Comunicado x) do Parceiro.java: escreve no socket.
  receba(comunicado: Comunicado): void {
    if (this.fechado) throw new Error("Erro de transmissão");
    this.conexao.write(JSON.stringify(comunicado) + "\n");
  }

  // espie(): olha o próximo Comunicado sem tirar da fila.
  async espie(): Promise<Comunicado> {
    await this.aguardarMensagem();
    return this.fila[0];
  }

  // envie(): consome e devolve o próximo Comunicado da fila.
  async envie(): Promise<Comunicado> {
    await this.aguardarMensagem();
    return this.fila.shift()!;
  }

  // adeus(): fecha a conexão.
  adeus(): void {
    this.conexao.end();
  }
}
