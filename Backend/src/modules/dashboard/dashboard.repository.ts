// src/modules/dashboard/dashboard.repository.ts
import { TransactionModel } from "../transactions/transactions.model";

export interface GrupoMensalMongo {
    _id: {
        rotulo: string;
        tipo: string;
    };
    total: number;
}

export const dashboardRepository = {
    async getTotaisDoMes(userId: string) {
        const incioDoMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const grupos = await TransactionModel.aggregate([
            { $match: { userId, data: { $gte: incioDoMes } } },
            {
                $group: {
                    _id: "$tipo",
                    total: { $sum: "$valor" },
                },
            },
        ]);

        const total = (tipo: string) => grupos.find((g) => g._id === tipo)?.total ?? 0;
        return { receitas: total("receita"), despesas: total("despesa") };
    },

    async getTotaisPorCategoria(userId: string) {
        return TransactionModel.aggregate([
            { $match: { userId, tipo: "despesa" } },
            { $group: { _id: "$categoria", total: { $sum: "$valor" } } },
            { $sort: { total: -1 } },
        ]);
    },

    async getTotaisPorMes(userId: string, dataInicio: Date): Promise<GrupoMensalMongo[]> {
        return TransactionModel.aggregate([
            { $match: { userId, data: { $gte: dataInicio } } },
            {
                $group: {
                    _id: {
                        rotulo: {
                            $dateToString: { format: "%Y-%m", date: "$data" },
                        },
                        tipo: "$tipo",
                    },
                    total: { $sum: "$valor" },
                },
            },
        ]);
    },
};