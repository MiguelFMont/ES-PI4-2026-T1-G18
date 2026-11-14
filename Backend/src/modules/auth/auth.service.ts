import jwt from "jsonwebtoken";
import { authRepository } from "./auth.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from "./auth.dto";
import { randomBytes, createHash } from "node:crypto";
import { emailService } from "../../shared/email/email.service";

export const authService = {
    async register(dados: RegisterDto) {
        const existente = await authRepository.findByEmail(dados.email);

        if (existente) {
            throw new AppError("E-mail já cadastrado", 409, "EMAIL_IN_USE");
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
        const token = jwt.sign(
            { id, email: usuario.email },
            env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return {
            usuario: {
                id,
                nome: usuario.nome,
                email: usuario.email,
                mfaEnabled: usuario.mfaEnabled
            },
            token
        };
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
    const existente = await authRepository.findByEmail(pendente.email);

    if (existente) {
        throw new AppError("E-mail já cadastrado", 409, "EMAIL_IN_USE");
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

