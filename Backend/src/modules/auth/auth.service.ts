import jwt from "jsonwebtoken";
import { authRepository } from "./auth.repository";
import { javaServerClient } from "../../java-client/java-server.client";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/app-error";
import { RegisterDto, LoginDto } from "./auth.dto";

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
    }
};
