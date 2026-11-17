import { SuporteModel } from "./suporte.model";
import type { CriarSuporteDto } from "./suporte.dto";
export const suporteRepository = {
    async criar(usuarioId: string, dados: CriarSuporteDto) {
        return await SuporteModel.create({
            usuarioId,
            assunto: dados.assunto,
            categoria: dados.categoria,
            descricao: dados.descricao
        });
    }
};
