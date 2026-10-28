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
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    senha: z.string().min(8),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;