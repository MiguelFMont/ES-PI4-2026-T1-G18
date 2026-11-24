/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { Schema, model, Types } from "mongoose";
export interface ISuporte {
    usuarioId: Types.ObjectId;
    assunto: string;
    categoria: string;
    descricao: string;
    status: "aberto" | "em_andamento" | "resolvido";
    createdAt?: Date;
    updatedAt?: Date;
}
const suporteSchema = new Schema<ISuporte>(
    {
        usuarioId: {type: Schema.Types.ObjectId,ref: "User",required: true},
        assunto: {type: String,required: true, trim: true,maxlength: 100},
        categoria: {type: String, required: true,
            enum: ["erro-tecnico", "conta-acesso", "plano", "outros"]
        },
        descricao: {type: String, required: true,minlength: 10},
        status: {type: String,
            enum: ["aberto", "em_andamento", "resolvido"],
            default: "aberto"
        }
    },
    {
        timestamps: true
    }
);
suporteSchema.index({ usuarioId: 1 });

export const SuporteModel = model<ISuporte>(
    "Suporte",
    suporteSchema
);
