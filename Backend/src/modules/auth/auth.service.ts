import jwt from "jsonwebtoken";
import { authRepository } from "./auth.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from "./auth.dto";
import { randomBytes, createHash } from "node:crypto";

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

        const usuario = await authRepository.create({
            ...dados,
            senhaHash: hash
        });

        return {
            id: usuario._id.toString(),
            nome: usuario.nome,
            email: usuario.email
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
            { valido: boolean }
        >(
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
        console.log("Link de recuperação de senha:", link);
    },

    async resetPassword(dados: ResetPasswordDto) {
        const tokenHash = createHash("sha256")
            .update(dados.token)
            .digest("hex");

        const { hash } = await javaServerClient.enviarPedido<
            { senha: string },
            { hash: string }
        >(
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
    }
};

