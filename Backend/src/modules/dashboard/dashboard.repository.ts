import { TransactionModel } from "../transactions/transactions.model";

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
        return {receitas: total("receita"), despesas: total("despesa")};
    },

    async getTotaisPorCategoria(userId: string) {
        return TransactionModel.aggregate([
            { $match: {userId, tipo: "despesa"} },
            { $group: { _id: "$categoria", total: { $sum: "$valor" } } },
            { $sort: { total: -1 } },
        ]);
    },
};