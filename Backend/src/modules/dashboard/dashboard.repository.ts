// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
import { TransactionModel } from "../transactions/transactions.model";

export interface GrupoMensalMongo {
    _id: {
        rotulo: string;
        tipo: string;
    };
    total: number;
}

export const dashboardRepository = {
    async getResumoDoPeriodo(userId: string, inicio: Date, fim: Date) {
        const [resultado] = await TransactionModel.aggregate([
            {
                $match: {
                    userId, // string, igual ao TransactionSchema
                    data: { $gte: inicio, $lte: fim },
                },
            },
            {
                $facet: {
                    totais: [
                        {
                            $group: {
                                _id: null,
                                totalGasto: {
                                    $sum: { $cond: [{ $eq: ["$tipo", "despesa"] }, "$valor", 0] },
                                },
                                totalReceitas: {
                                    $sum: { $cond: [{ $eq: ["$tipo", "receita"] }, "$valor", 0] },
                                },
                                numeroTransacoes: { $sum: 1 },
                                numeroDespesas: {
                                    $sum: { $cond: [{ $eq: ["$tipo", "despesa"] }, 1, 0] },
                                },
                            },
                        },
                    ],
                    porCategoria: [
                        { $match: { tipo: "despesa" } },
                        {
                            $group: {
                                _id: "$categoria",
                                total: { $sum: "$valor" },
                            },
                        },
                        { $sort: { total: -1, _id: 1 } },
                        { $limit: 1 },
                    ],
                },
            },
        ]);

        const totais = resultado?.totais?.[0] ?? {
            totalGasto: 0,
            totalReceitas: 0,
            numeroTransacoes: 0,
            numeroDespesas: 0,
        };

        const topCategoria = resultado?.porCategoria?.[0] as
            | { _id: string; total: number }
            | undefined;

        return {
            totais: {
                totalGasto: Number(totais.totalGasto ?? 0),
                totalReceitas: Number(totais.totalReceitas ?? 0),
                numeroTransacoes: Number(totais.numeroTransacoes ?? 0),
                numeroDespesas: Number(totais.numeroDespesas ?? 0),
            },
            topCategoria: topCategoria
                ? { categoria: topCategoria._id, total: Number(topCategoria.total) }
                : null,
        };
    },
    
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