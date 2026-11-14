
import { Schema, model } from "mongoose";

interface PendingRegistrationDocument {
    nome: string;
    email: string;
    cpf: string;
    senhaHash: string;
    tokenHash: string;
    expiresAt: Date;
}

const PendingRegistrationSchema = new Schema<PendingRegistrationDocument>({
    nome: { type: String, required: true },
    email: { type: String, required: true },
    cpf: { type: String, required: true },
    senhaHash: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

PendingRegistrationSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

export const PendingRegistrationModel = model<PendingRegistrationDocument>(
    "PendingRegistration",
    PendingRegistrationSchema
);
