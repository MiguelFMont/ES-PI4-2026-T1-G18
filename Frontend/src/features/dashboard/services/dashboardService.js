// src/features/dashboard/services/dashboardService.js
import { api } from '../../../core/http/api.js';

const DADOS_MOCK = {
    receitas: 15670.00,
    despesas: 7087.00,
    saldo: 8583.00,
    economia: 54.77,
    fluxoDeCaixa: 8583.00,
};

export async function buscarResumoDashboard({ usarMock = false } = {}) {
    if (usarMock) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        return DADOS_MOCK;
    }

    return await api('/dashboard/summary');
}