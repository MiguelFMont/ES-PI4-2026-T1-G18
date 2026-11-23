/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { authRepository } from "../auth.repository";
import { javaServerClient } from "../../../java-client/java-server.client";
import { AppError } from "../../../shared/errors/app-error";

export const mfaService = {
    async enable(userId: string) {
        const usuario = await authRepository.findById(userId);

        if (!usuario) {
            throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
        }

        if (usuario.mfaEnabled) {
            throw new AppError("MFA já está ativado", 409, "MFA_ALREADY_ENABLED");
        }

        const { segredo, uri } = await javaServerClient.enviarPedido<
            { email: string },
            { segredo: string; uri: string }
        >(
            "PedidoGerarSegredoMFA",
            "RespostaGerarSegredoMFA",
            { email: usuario.email }
        );

        await authRepository.setMfaSecret(userId, segredo);

        return {
            mensagem: "Escaneie o QR Code no aplicativo autenticador.",
            uri
        };
    },

    async validate(userId: string, codigo: string) {
        if (!/^\d{6}$/.test(codigo ?? "")) {
            throw new AppError("Código inválido", 400, "INVALID_MFA_CODE");
        }

        const segredo = await authRepository.findMfaSecret(userId);

        if (!segredo) {
            throw new AppError("MFA não configurado", 400, "MFA_NOT_CONFIGURED");
        }

        const { valido } = await javaServerClient.enviarPedido<
            { segredo: string; codigo: string },
            { valido: boolean }
        >(
            "PedidoValidarMFA",
            "RespostaValidarMFA",
            { segredo, codigo }
        );

        if (!valido) {
            throw new AppError("Código MFA incorreto", 401, "INVALID_MFA_CODE");
        }

        await authRepository.enableMfa(userId);

        return {
            mensagem: "MFA validado com sucesso",
            mfaEnabled: true
        };
    },

    async disable(userId: string, codigo: string) {
        if (!/^\d{6}$/.test(codigo ?? "")) {
            throw new AppError("Código inválido", 400, "INVALID_MFA_CODE");
        }

        const usuario = await authRepository.findById(userId);

        if (!usuario) {
            throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
        }

        if (!usuario.mfaEnabled) {
            throw new AppError("MFA não está ativado", 400, "MFA_NOT_ENABLED");
        }

        const segredo = await authRepository.findMfaSecret(userId);

        if (!segredo) {
            throw new AppError("Segredo MFA não encontrado", 400, "MFA_NOT_CONFIGURED");
        }

        const { valido } = await javaServerClient.enviarPedido<
            { segredo: string; codigo: string },
            { valido: boolean }
        >(
            "PedidoValidarMFA",
            "RespostaValidarMFA",
            { segredo, codigo }
        );

        if (!valido) {
            throw new AppError("Código MFA incorreto", 401, "INVALID_MFA_CODE");
        }

        await authRepository.disableMfa(userId);

        return {
            mensagem: "MFA desativado com sucesso",
            mfaEnabled: false
        };
    }
};
