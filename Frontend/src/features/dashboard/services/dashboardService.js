// src/features/dashboard/services/dashboardService.js
import { api } from '../../../core/http/api.js';

export async function buscarResumoDashboard() {
    return await api('/dashboard/summary');
}

export async function buscarGastosPorCategoria() {
    return await api('/dashboard/by-category');
}

export async function buscarComparacaoPeriodos(periodo = 'mes') {
    return await api(`/dashboard/compare?periodo=${encodeURIComponent(periodo)}`);
}

export async function buscarTransacoesDoPeriodo({ dataInicio, dataFim } = {}) {
    const params = new URLSearchParams({ limite: '100' });
    if (dataInicio) params.set('dataInicio', dataInicio);
    if (dataFim) params.set('dataFim', dataFim);

    const resposta = await api(`/transactions?${params.toString()}`);
    const itens = Array.isArray(resposta) ? resposta : (resposta?.itens ?? []);

    return itens.filter((t) => {
        const dataIso = String(t.data ?? '').slice(0, 10);
        if (dataInicio && dataIso < dataInicio) return false;
        if (dataFim && dataIso > dataFim) return false;
        return true;
    });
}