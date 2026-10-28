import { z } from "zod";

export const registerSchema = z.object({
    nome: z.string().min(1),
    email: z.string().email(),
    cpf: z.string().length(11),
    senha: z.string().min(8),
});

export const loginSchema = z.object({
    email: z.string().email(),
    senha: z.string().min(1),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
