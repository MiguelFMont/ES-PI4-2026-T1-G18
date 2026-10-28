import { UserModel } from "./auth.model";
import { RegisterDto } from "./auth.dto";

export const authRepository = {
    async findByEmail(email: string) {
        return UserModel.findOne({ email }).lean();
    },

    async findById(id: string) {
        return UserModel.findById(id).lean();
    },
    async create(dados: RegisterDto & { senhaHash: string }) {
        const usuario = await UserModel.create({
            nome: dados.nome,
            email: dados.email,
            cpf: dados.cpf,
            senhaHash: dados.senhaHash,
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
};
