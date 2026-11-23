/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { criarSuporteSchema } from "./suporte.dto";
import { suporteRepository } from "./suporte.repository";
import type { CriarSuporteDto } from "./suporte.dto";
export const suporteService = {
    async criar(usuarioId: string, dados: CriarSuporteDto) {
        const dadosValidados = criarSuporteSchema.parse(dados);
        const relatorio = await suporteRepository.criar(
            usuarioId,
            dadosValidados
        );
        return {
            mensagem: "Problema reportado com sucesso!",
            relatorio: {
                id: relatorio._id,
                assunto: relatorio.assunto,
                categoria: relatorio.categoria,
                descricao: relatorio.descricao,
                status: relatorio.status,
                createdAt: relatorio.createdAt
            }
        };
    }
};
