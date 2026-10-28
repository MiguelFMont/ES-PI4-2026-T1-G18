import { Schema, model } from "mongoose";

interface UserDocument {
    nome: string;
    email: string;
    cpf: string;
    senhaHash: string;
    resetPasswordTokenHash?: string;
    resetPasswordExpiresAt?: Date;
    mfaEnabled: boolean;
    mfaSecret?: string;
    plano: "free" | "pro";
    preferencias: {
        tema: "claro" | "escuro";
        ocultarValores: boolean;
    };
}

const UserSchema = new Schema<UserDocument>(
    {
        nome: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        cpf: { type: String, required: true, unique: true },
        senhaHash: { type: String, required: true },
        resetPasswordTokenHash: { type: String, select: false },
        resetPasswordExpiresAt: { type: Date, select: false },
        mfaEnabled: { type: Boolean, default: false },
        mfaSecret: { type: String, select: false },
        plano: {
            type: String,
            enum: ["free", "pro"],
            default: "free"
        },
        preferencias: {
            tema: {
                type: String,
                enum: ["claro", "escuro"],
                default: "claro"
            },
            ocultarValores: {
                type: Boolean,
                default: false
            }
        }
    },
    { timestamps: true }
);

export const UserModel = model<UserDocument>("User", UserSchema);
