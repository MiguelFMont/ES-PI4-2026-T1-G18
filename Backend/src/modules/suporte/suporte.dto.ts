import { z } from "zod";
export const criarSuporteSchema = z.object({
    assunto: z.string()
        .trim()
        .min(1, "O assunto é obrigatório")
        .max(100, "O assunto deve ter no máximo 100 caracteres"),

    categoria: z.enum([
        "erro-tecnico",
        "conta-acesso",
        "plano",
        "outros"
    ]),

    descricao: z.string()
        .trim()
        .min(10, "A descrição deve ter pelo menos 10 caracteres")
});

export type CriarSuporteDto = z.infer<typeof criarSuporteSchema>;
