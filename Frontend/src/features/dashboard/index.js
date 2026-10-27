// src/features/dashboard/index.js
import { iniciarTema } from '../../core/theme/theme.js';
import { ligarMenu } from '../../core/layout/menu.js';
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarDashboardHeader } from './components/DashboardHeader/DashboardHeader.js';
import { iniciarDashboardResumo } from './components/DashboardResumo/DashboardResumo.js';
import { mostrarEstadoDashboard } from './components/DashboardEstado/DashboardEstado.js';
import { buscarResumoDashboard } from './services/dashboardService.js';

async function inicializarPagina() {
    iniciarTema();
    ligarMenu();

    // 1. Substitui todos os <div data-incluir="..."> pelos HTMLs dos componentes
    await incluirFragmentos(document);

    // 2. Inicia os componentes
    iniciarDashboardHeader();
    await carregarDadosDashboard();
}

async function carregarDadosDashboard() {
    try {
        mostrarEstadoDashboard({ tipo: 'carregando', mensagem: 'Carregando saldo e gastos do mês...' });

        // Se quiser testar com dados mockados sem o Backend, passe { usarMock: true }
        const dados = await buscarResumoDashboard({ usarMock: true });

        mostrarEstadoDashboard({ tipo: 'oculto' });
        iniciarDashboardResumo(dados);
    } catch (erro) {
        mostrarEstadoDashboard({
        tipo: 'erro',
        mensagem: erro.message || 'Erro ao carregar os dados do painel.',
        aoTentarNovamente: carregarDadosDashboard,
        });
    }
}

inicializarPagina();