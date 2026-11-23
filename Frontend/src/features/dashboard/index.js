// src/features/dashboard/index.js
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarDashboardHeader } from './components/DashboardHeader/DashboardHeader.js';
import { mostrarEstadoDashboard } from './components/DashboardEstado/DashboardEstado.js';
import { iniciarDashboardResumo } from './components/DashboardResumo/DashboardResumo.js';
import { iniciarDashboardCategorias } from './components/DashboardCategorias/DashboardCategorias.js';
import { iniciarDashboardComparacao } from './components/DashboardComparacao/DashboardComparacao.js';
import {
    buscarComparacaoPeriodos,
    buscarTransacoesDoPeriodo,
} from './services/dashboardService.js';

let controladorTela = null;

export async function montar(container) {
    controladorTela?.abort();
    controladorTela = new AbortController();
    const { signal } = controladorTela;

    await incluirFragmentos(container);

    const resumo = iniciarDashboardResumo(container);
    const categorias = iniciarDashboardCategorias(container, { signal });

    const header = iniciarDashboardHeader(container, {
        aoMudarPeriodo: (periodo) => carregarDadosDoPeriodo(periodo),
        signal,
    });

    const comparacao = iniciarDashboardComparacao(container, {
        aoMudarTipo: (tipo) => carregarComparacao(tipo),
        signal,
    });

    async function carregarDadosDoPeriodo(periodo = header.lerPeriodo()) {
        try {
        mostrarEstadoDashboard(container, { tipo: 'oculto' });
        const transacoes = await buscarTransacoesDoPeriodo(periodo);

        resumo.atualizarPorTransacoes(transacoes);
        categorias.atualizar(transacoes, periodo.rotulo);
        } catch (erro) {
        mostrarEstadoDashboard(container, {
            tipo: 'erro',
            mensagem: erro?.message || 'Não foi possível carregar os dados do período selecionado.',
            aoTentarNovamente: () => carregarDadosDoPeriodo(header.lerPeriodo()),
        });
        }
    }

    async function carregarComparacao(tipo = 'mes') {
        try {
        const dados = await buscarComparacaoPeriodos(tipo);
        comparacao.mostrar(dados);
        if (tipo === 'mes') {
            resumo.atualizarVariacoes(dados?.periodos ?? []);
        }
        if (tipo === '6meses' || tipo === 'ytd') {
            categorias.atualizarEvolucaoMensal(dados?.periodos ?? []);
        }
        } catch {
        // Ignora se o Servidor Java estiver offline
        }
    }

    async function carregarEvolucao6Meses() {
        try {
        const dados6m = await buscarComparacaoPeriodos('6meses');
        categorias.atualizarEvolucaoMensal(dados6m?.periodos ?? []);
        } catch {
        categorias.atualizarEvolucaoMensal([]);
        }
    }

    await Promise.all([
        carregarDadosDoPeriodo(header.lerPeriodo()),
        carregarComparacao('mes'),
        carregarEvolucao6Meses(),
    ]);
}

export function desmontar() {
    controladorTela?.abort();
    controladorTela = null;
}