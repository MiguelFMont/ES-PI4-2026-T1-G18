/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { Schema, model } from "mongoose";

interface UserDocument {
    nome: string;
    email: string;
    cpf: string;
    senhaHash: string;
    emailVerificado: boolean;
    emailVerificationTokenHash?: string;
    emailVerificationExpiresAt?: Date;
    resetPasswordTokenHash?: string;
    resetPasswordExpiresAt?: Date;
    mfaEnabled: boolean;
    mfaSecret?: string;
    mfaUltimoContador?: number;
    plano: "free" | "pro";
    preferencias: {
        tema: "claro" | "escuro";
        estilo: "sombras" | "bordas";
        ocultarValores: boolean;
    };
}

const UserSchema = new Schema<UserDocument>(
    {
        nome: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        cpf: { type: String, required: true, unique: true },
        senhaHash: { type: String, required: true },
        emailVerificado: {type: Boolean, default: false},
        emailVerificationTokenHash: {type: String, select: false},
        emailVerificationExpiresAt: {type: Date, select: false},
        resetPasswordTokenHash: { type: String, select: false },
        resetPasswordExpiresAt: { type: Date, select: false },
        mfaEnabled: { type: Boolean, default: false },
        mfaSecret: { type: String, select: false },
        mfaUltimoContador: { type: Number, select: false },
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
            estilo: {
                type: String,
                enum: ["sombras", "bordas"],
                default: "sombras"
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
