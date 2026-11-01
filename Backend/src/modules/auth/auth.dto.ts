import { z } from "zod";

function validarCPF(cpf: string): boolean {
    if (cpf.length !== 11 || !/^\d{11}$/.test(cpf)) {
        return false;
    }

    // Impede CPFs com todos os números iguais
    if (cpf.split("").every(digito => digito === cpf[0])) {
        return false;
    }

    // Calcula os dígitos verificadores
    for (let tamanho = 9; tamanho < 11; tamanho++) {
        let soma = 0;

        for (let i = 0; i < tamanho; i++) {
            soma += Number(cpf[i]) * (tamanho + 1 - i);
        }
        // Calcula o dígito verificador
        const resto = (soma * 10) % 11;
        const digito = resto === 10 ? 0 : resto;
        // Verifica se o dígito verificador calculado é igual ao dígito verificador do CPF
        if (digito !== Number(cpf[tamanho])) {
            return false;
        }
    }

    return true;
}
const senhaSchema = z.string()
    .min(8, { message: "A senha deve ter no mínimo 8 caracteres" })
    .regex(
        //obrigatorio conter na senha
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
        "A senha deve conter pelo menos uma letra maiúscula, numeros e caracteres especiais",
    )

export const registerSchema = z.object({
    nome: z.string().min(1),
    email: z.string().email(),
    cpf: z.string().length(11).refine(validarCPF, { message: "CPF inválido" }),
    senha: senhaSchema,
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
    senha: senhaSchema,
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;