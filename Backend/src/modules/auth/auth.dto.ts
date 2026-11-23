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
// Regras da senha (o cadastro no Frontend, em inicio.js, mostra as mesmas): pelo menos 8 caracteres, uma letra
// minúscula, uma maiúscula, um número e um caractere especial. Letras acentuadas contam como letras e qualquer símbolo
// (! @ # $ % - _ . ...) conta como caractere especial; espaço não conta. Cada regra tem a própria mensagem, para o
// usuário saber exatamente o que falta.
export const senhaSchema = z.string()
    .min(8, { message: "A senha deve ter no mínimo 8 caracteres" })
    .regex(/\p{Ll}/u, "A senha deve ter pelo menos uma letra minúscula")
    .regex(/\p{Lu}/u, "A senha deve ter pelo menos uma letra maiúscula")
    .regex(/\p{Nd}/u, "A senha deve ter pelo menos um número")
    .regex(/[^\p{L}\p{N}\s]/u, "A senha deve ter pelo menos um caractere especial (ex.: ! @ # $ % - _)");

// E-mail sem espaços nas pontas e em minúsculas: "Ana@X.com " e "ana@x.com" são a mesma conta.
const emailSchema = z.string().trim().toLowerCase().email({ message: "E-mail inválido" });

export const registerSchema = z.object({
    nome: z.string().trim().min(1, "Informe o nome"),
    email: emailSchema,
    cpf: z.string().length(11, "O CPF deve ter 11 dígitos").refine(validarCPF, { message: "CPF inválido" }),
    senha: senhaSchema,
});

export const loginSchema = z.object({
    email: emailSchema,
    senha: z.string().min(1),
});
export const forgotPasswordSchema = z.object({
    email: emailSchema,
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    senha: senhaSchema,
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const atualizarPerfilSchema = z.object({
    nome: z.string()
        .trim()
        .min(1, "O nome não pode estar vazio")
        .optional(),

    preferencias: z.object({
        tema: z.enum(["claro", "escuro"]).optional(),
        estilo: z.enum(["sombras", "bordas"]).optional(),
        ocultarValores: z.boolean().optional()
    }).strict().optional()
}).strict().refine(
    dados => dados.nome !== undefined &&
        dados.nome !== "" ||
        dados.preferencias !== undefined &&
        Object.keys(dados.preferencias).length > 0,
    { message: "Informe pelo menos um campo para atualizar" }
);

export type AtualizarPerfilDto = z.infer<typeof atualizarPerfilSchema>;