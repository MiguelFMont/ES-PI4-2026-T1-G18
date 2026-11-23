// src/shared/aparencia/aparencia.ts
// A aparência de uma conta, de uma meta ou de um cartão: um ícone (uma chave da lista abaixo) e uma cor (um dos matizes do Frontend,
// core/styles/global.css). Os dois são opcionais: sem eles o Frontend mostra o padrão (o logo do banco, nas contas e nos cartões).
// O desenho de cada chave mora no Frontend (shared/utils/icones.js): aqui só se guarda e valida a chave.
import { z } from "zod";

export const ICONES = ["carteira", "banco", "cofrinho", "cartao", "cedulas", "casa", "mala", "carro", "escola", "coracao", "grafico", "estrela"] as const;
export const CORES = ["azul", "roxo", "rosa", "laranja", "ambar", "turquesa", "verde", "vermelho", "cinza"] as const;

export type Icone = (typeof ICONES)[number];
export type Cor = (typeof CORES)[number];

const icone = z.enum(ICONES);
const cor = z.enum(CORES);

/** Campos de ícone e cor na criação: opcionais. */
export const aparenciaNaCriacao = { icone: icone.optional(), cor: cor.optional() };

/** Campos de ícone e cor na edição: `null` tira o ícone (ou a cor) e volta ao padrão. */
export const aparenciaNaEdicao = {
  icone: z.union([z.null(), icone]).optional(),
  cor: z.union([z.null(), cor]).optional(),
};

/** Os dois campos como saem na resposta da API (só os que existem). */
export const aparenciaNaResposta = (doc: { icone?: string | null; cor?: string | null }) => ({
  ...(doc.icone ? { icone: doc.icone } : {}),
  ...(doc.cor ? { cor: doc.cor } : {}),
});
