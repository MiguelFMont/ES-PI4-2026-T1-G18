import { UserModel } from "./auth.model";
import { RegisterDto } from "./auth.dto";
import { PendingRegistrationModel } from "./pending-registration.model";

export const authRepository = {
    async findByEmail(email: string) {
        return UserModel.findOne({ email }).lean();
    },

    async findById(id: string) {
        return UserModel.findById(id).lean();
    },
    
    async atualizarPlano(userId: string, plano: "free" | "pro") {
        return UserModel.findByIdAndUpdate(
            userId,
            { plano},
            { new: true }
        ).lean();
    },
    async create(dados: { nome: string; email: string; cpf: string; senhaHash: string }) {
        const usuario = await UserModel.create({
            nome: dados.nome,
            email: dados.email,
            cpf: dados.cpf,
            senhaHash: dados.senhaHash,
            emailVerificado: true
        });

        return usuario.toObject();
    },

    async setMfaSecret(userId: string, mfaSecret: string) {
        return UserModel.findByIdAndUpdate(
            userId,
            { mfaSecret, mfaEnabled: true },
            { new: true }
        ).lean();
    },

    async findMfaSecret(userId: string) {
        const usuario = await UserModel.findById(userId)
            .select("+mfaSecret")
            .lean();

        return usuario?.mfaSecret ?? null;
    },

    async savePasswordResetToken(
        userId: string,
        tokenHash: string,
        expiresAt: Date
    ) {
        return UserModel.findByIdAndUpdate(
            userId,
            {
                resetPasswordTokenHash: tokenHash,
                resetPasswordExpiresAt: expiresAt
            },
            { new: true }
        ).lean();
    },

    async resetPassword(
        tokenHash: string,
        senhaHash: string
    ) {
        return UserModel.findOneAndUpdate(
            {
                resetPasswordTokenHash: tokenHash,
                resetPasswordExpiresAt: { $gt: new Date() }
            },
            {
                $set: { senhaHash }, $unset: {resetPasswordTokenHash: "", resetPasswordExpiresAt: ""}
            },
            { new: true }
        ).lean();
    },
    async saveEmailVerificationToken(
        userId: string,
        tokenHash: string,
        expiresAt: Date
    ) {
        return UserModel.findByIdAndUpdate(
            userId,
            {
                emailVerificationTokenHash: tokenHash,
                emailVerificationExpiresAt: expiresAt
            },
            { new: true }
        ).lean();
    },
    async verifyEmail(tokenHash: string) {
        return UserModel.findOneAndUpdate(
            {
                emailVerificationTokenHash: tokenHash,
                emailVerificationExpiresAt: { $gt: new Date() },
                emailVerificado: false
            },
            {
                $set: { emailVerificado: true },
                $unset: {
                    emailVerificationTokenHash: "",
                    emailVerificationExpiresAt: ""
                }
            },
            { new: true }
        ).lean();
    },
    async createPendingRegistration(dados: {
        nome: string;
        email: string;
        cpf: string;
        senhaHash: string;
        tokenHash: string;
        expiresAt: Date;
    }) {
        return PendingRegistrationModel.create(dados);
    },

    async findPendingRegistration(tokenHash: string) {
    return PendingRegistrationModel.findOne({
        tokenHash,
        expiresAt: { $gt: new Date() }
    });
    },

    async deletePendingRegistration(id: string) {
        return PendingRegistrationModel.findByIdAndDelete(id);
    }   
};
