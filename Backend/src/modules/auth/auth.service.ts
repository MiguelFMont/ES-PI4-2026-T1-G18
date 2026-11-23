import { authRepository } from "./auth.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { atualizarPerfilSchema, type AtualizarPerfilDto, RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from "./auth.dto";
import { randomBytes, createHash } from "node:crypto";
import { emailService } from "../../shared/email/email.service";
import jwt, { type JwtPayload } from "jsonwebtoken";

const emailEmUso = () => new AppError("E-mail já cadastrado", 409, "EMAIL_IN_USE");
const cpfEmUso = () => new AppError("CPF já cadastrado", 409, "CPF_IN_USE");

function gerarTokenAcesso(id: string, email: string) {
    return jwt.sign(
        { id, email },
        env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function gerarRespostaLogin(usuario: {
    _id: { toString(): string };
    nome: string;
    email: string;
    mfaEnabled: boolean;
}) {
    const id = usuario._id.toString();

    return {
        usuario: {
            id,
            nome: usuario.nome,
            email: usuario.email,
            mfaEnabled: usuario.mfaEnabled
        },
        token: gerarTokenAcesso(id, usuario.email)
    };
}

export const authService = {
    async register(dados: RegisterDto) {
        // O CPF também é único: sem esta checagem o cadastro pendente era criado e a confirmação do e-mail quebrava
        // no índice único do banco (erro 500).
        const [existente, cpfExistente] = await Promise.all([
            authRepository.findByEmail(dados.email),
            authRepository.findByCpf(dados.cpf),
        ]);

        if (existente) {
            throw emailEmUso();
        }
        if (cpfExistente) {
            throw cpfEmUso();
        }

        const { hash } = await javaServerClient.enviarPedido<
            { senha: string },
            { hash: string }
        >(
            "PedidoHashSenha",
            "RespostaHashSenha",
            { senha: dados.senha }
        );

        const token = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

        await authRepository.createPendingRegistration({
            nome: dados.nome,
            email: dados.email,
            cpf: dados.cpf,
            senhaHash: hash,
            tokenHash,
            expiresAt
        });

        const link = `http://localhost:3001/src/features/auth/components/confirmarEmail.html?token=${token}`;
        await emailService.enviarConfirmacaoEmail(dados.email, link);

        return {
            mensagem: "Enviamos um link de confirmação para seu e-mail."
        };
    },

    async login(dados: LoginDto) {
        const usuario = await authRepository.findByEmail(dados.email);

        if (!usuario) {
            throw new AppError(
                "Credenciais inválidas",
                401,
                "INVALID_CREDENTIALS"
            );
        }

        const { valido } = await javaServerClient.enviarPedido<
            { senha: string; hash: string },
            { valido: boolean }>(
            "PedidoValidarSenha",
            "RespostaValidarSenha",
            {
                senha: dados.senha,
                hash: usuario.senhaHash
            }
        );

        if (!valido) {
            throw new AppError(
                "Credenciais inválidas",
                401,
                "INVALID_CREDENTIALS"
            );
        }
        if (!usuario.emailVerificado) {
            throw new AppError("Confirme seu e-mail antes de fazer login.", 403, "EMAIL_NOT_VERIFIED");
        }

        const id = usuario._id.toString();

        if (usuario.mfaEnabled) {
            const mfaToken = jwt.sign(
            {
                id,
                tipo: "mfa_pending"
            },
             env.MFA_JWT_SECRET,
            { expiresIn: "3m" }
        );

        return {
            mfaRequired: true,
            mfaToken
        };
    }

    return gerarRespostaLogin(usuario);
    },
        async loginMfa(mfaToken: string, codigo: string) {
        if (
            typeof mfaToken !== "string" ||
            !mfaToken ||
            typeof codigo !== "string" ||
            !/^\d{6}$/.test(codigo)
        ) {
            throw new AppError(
                "Token temporário ou código MFA inválido",
                400,
                "INVALID_MFA_REQUEST"
            );
        }

        let payload: JwtPayload;

        try {
            const verificado = jwt.verify(
                mfaToken,
                env.MFA_JWT_SECRET,
                { algorithms: ["HS256"] }
            );

            if (
                typeof verificado === "string" ||
                verificado.tipo !== "mfa_pending" ||
                typeof verificado.id !== "string"
            ) {
                throw new Error("Token MFA inválido");
            }

            payload = verificado;
        } catch {
            throw new AppError(
                "Verificação MFA inválida ou expirada",
                401,
                "INVALID_MFA_TOKEN"
            );
        }

        const usuario = await authRepository.findById(payload.id);

        if (!usuario || !usuario.mfaEnabled || !usuario.emailVerificado) {
            throw new AppError(
                "Verificação MFA não autorizada",
                401,
                "MFA_NOT_AUTHORIZED"
            );
        }

        const segredo = await authRepository.findMfaSecret(
            usuario._id.toString()
        );

        if (!segredo) {
            throw new AppError(
                "MFA não configurado",
                400,
                "MFA_NOT_CONFIGURED"
            );
        }
        const { valido, contador} = await javaServerClient.enviarPedido<
            { segredo: string; codigo: string },
            { valido: boolean; contador: number | null  }
        >(
            "PedidoValidarMFA",
            "RespostaValidarMFA",
            { segredo, codigo }
        );

        if (!valido) {
            throw new AppError(
                "Código MFA incorreto",
                401,
                "INVALID_MFA_CODE"
            );
        }
        if (
            !Number.isSafeInteger(contador) ||
            contador === null ||
            contador < 0
        ) {
            throw new AppError(
            "Resposta de validação MFA inválida",
            500,
            "INVALID_MFA_RESPONSE"
        );
    }

    const registrado = await authRepository.registrarContadorMfa(
        usuario._id.toString(),
        contador
    );

    if (!registrado) {
        throw new AppError(
            "Código MFA já utilizado ou expirado. Aguarde um novo código.",
            401,
            "MFA_CODE_ALREADY_USED"
        );
    }
        return gerarRespostaLogin(usuario);
    },

    async getProfile(id: string) {
        const usuario = await authRepository.findById(id);

        if (!usuario) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USER_NOT_FOUND"
            );
        }

        return {
            id: usuario._id.toString(),
            nome: usuario.nome,
            email: usuario.email,
            plano: usuario.plano,
            preferencias: usuario.preferencias,
            mfaEnabled: usuario.mfaEnabled
        };
    },
    
    async atualizarPlano(id: string,  plano: "free" | "pro") {
        const usuario = await authRepository.atualizarPlano(id, plano);

        if (!usuario) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USER_NOT_FOUND"
            );
        }

        return {
            id: usuario._id.toString(),
            nome: usuario.nome,
            email: usuario.email,
            plano: usuario.plano
        };
    },
    async atualizarPerfil(id: string, dados: AtualizarPerfilDto) {
        const dadosValidados = atualizarPerfilSchema.parse(dados);

        const usuario = await authRepository.atualizarPerfil(
            id,
            dadosValidados
        );

        if (!usuario) {
            throw new AppError(
                "Usuário não encontrado",
                404,
                "USER_NOT_FOUND"
            );
        }

        return {
            id: usuario._id.toString(),
            nome: usuario.nome,
            email: usuario.email,
            plano: usuario.plano,
            preferencias: usuario.preferencias
        };
    },

    async forgotPassword(dados: ForgotPasswordDto) {
        const usuario = await authRepository.findByEmail(dados.email);

        if (!usuario) {
            return;
        }

        const token = randomBytes(32).toString("hex");

        const tokenHash = createHash("sha256")
            .update(token)
            .digest("hex");

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await authRepository.savePasswordResetToken(
            usuario._id.toString(),
            tokenHash,
            expiresAt
        );
        //link para pagina de redefinir pelo link sem ser por email
        const link = `http://localhost:3001/src/features/auth/components/redefinirSenha.html?token=${token}`;
        await emailService.enviarRecuperacaoSenha(usuario.email, link);
    },

    async resetPassword(dados: ResetPasswordDto) {
        const tokenHash = createHash("sha256")
            .update(dados.token)
            .digest("hex");

        const { hash } = await javaServerClient.enviarPedido<
            { senha: string },
            { hash: string }>(
            "PedidoHashSenha",
            "RespostaHashSenha",
            { senha: dados.senha }
        );

        const usuario = await authRepository.resetPassword(
            tokenHash,
            hash
        );

        if (!usuario) {
            throw new AppError(
                "Link de recuperação inválido ou expirado",
                400,
                "INVALID_RESET_TOKEN"
            );
        }
    },

    async verifyEmail(token: string) {
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const pendente = await authRepository.findPendingRegistration(tokenHash);

        if (!pendente) {
            throw new AppError(
                "Link de confirmação inválido ou expirado",
                400,
                "INVALID_VERIFICATION_TOKEN"
            );
        }
    // Dois cadastros pendentes podem ter o mesmo e-mail ou CPF: só o primeiro confirmado vale.
    const [existente, cpfExistente] = await Promise.all([
        authRepository.findByEmail(pendente.email),
        authRepository.findByCpf(pendente.cpf),
    ]);

    if (existente) {
        throw emailEmUso();
    }
    if (cpfExistente) {
        throw cpfEmUso();
    }

    await authRepository.create({
        nome: pendente.nome,
        email: pendente.email,
        cpf: pendente.cpf,
        senhaHash: pendente.senhaHash,
    });

    await authRepository.deletePendingRegistration(pendente._id.toString());

    return { mensagem: "E-mail confirmado com sucesso!" };
}
};

