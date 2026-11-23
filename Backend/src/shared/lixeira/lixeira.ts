/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
// src/shared/lixeira/lixeira.ts
// "Desfazer" de uma exclusão em cascata (conta ou cartão): antes de apagar, quem exclui guarda aqui uma função que traz tudo de volta (com os
// mesmos ids). O usuário tem 30 segundos para usar o id que a rota de exclusão devolveu (POST /v1/undo/:id). A lixeira fica só na memória do
// processo: se o Backend reiniciar, o que ela guardava se perde (o desfazer é uma cortesia de poucos segundos, não um backup).
import { randomUUID } from "node:crypto";
import { AppError } from "../errors/app-error";

const VALIDADE_MS = 30 * 1000;

interface Entrada {
  userId: string;
  expiraEm: number;
  restaurar: () => Promise<void>;
}

const entradas = new Map<string, Entrada>();

function limparVencidas(agora: number) {
  for (const [id, entrada] of entradas) if (entrada.expiraEm <= agora) entradas.delete(id);
}

/** Guarda como restaurar uma exclusão. Devolve o id que o usuário usa para desfazer. */
export function guardarParaDesfazer(userId: string, restaurar: () => Promise<void>): string {
  limparVencidas(Date.now());
  const id = randomUUID();
  entradas.set(id, { userId, expiraEm: Date.now() + VALIDADE_MS, restaurar });
  return id;
}

/** Desfaz a exclusão (uma vez só). 404 se o id não existe, é de outro usuário ou o prazo acabou. */
export async function desfazerExclusao(userId: string, id: string): Promise<void> {
  limparVencidas(Date.now());
  const entrada = entradas.get(id);
  if (!entrada || entrada.userId !== userId) {
    throw new AppError("Não há mais nada para desfazer (o prazo acabou)", 404, "UNDO_NOT_FOUND");
  }
  entradas.delete(id);
  try {
    await entrada.restaurar();
  } catch (erro: any) {
    // um nome que o usuário reutilizou depois da exclusão, por exemplo
    if (erro?.code === 11000) throw new AppError("Não foi possível desfazer: algo com o mesmo nome já existe", 409, "UNDO_CONFLICT");
    throw erro;
  }
}

/** Só para os testes. */
export const esvaziarLixeira = () => entradas.clear();
