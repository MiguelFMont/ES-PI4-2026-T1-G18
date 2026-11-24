// src/shared/utils/texto.ts

// Minúsculas, sem acentos e só letras e espaços simples. Serve para comparar descrições de transações.
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}
