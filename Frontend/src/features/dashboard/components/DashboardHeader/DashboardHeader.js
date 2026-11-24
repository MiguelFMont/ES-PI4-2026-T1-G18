// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
import { obterIntervaloPeriodo } from '../../utils/dashboardGrupos.js';

async function buscarNomeUsuario() {
    const token = localStorage.getItem('@FinanceAI:token');
    if (!token) return 'Usuário';

    try {
        const resposta = await fetch('/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        });
        if (resposta.ok) {
        const usuario = await resposta.json();
        const nomeCompleto = usuario?.nome || usuario?.name || '';
        if (nomeCompleto) return nomeCompleto.split(' ')[0];
        }
    } catch {
        // Fallback para decodificação do token JWT
    }

    try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = JSON.parse(atob(payloadBase64));
        const nomeJwt = payloadJson?.nome || payloadJson?.name;
        if (nomeJwt) return nomeJwt.split(' ')[0];
    } catch {
        // Ignora falhas de decodificação
    }

    return 'Usuário';
}

export function iniciarDashboardHeader(raiz, { aoMudarPeriodo, signal } = {}) {
    const titulo = raiz.querySelector('#dashboard-titulo');
    const atalhos = raiz.querySelector('#dashboard-atalhos-periodo');
    const inputInicio = raiz.querySelector('#dash-data-inicio');
    const inputFim = raiz.querySelector('#dash-data-fim');

    if (titulo) {
        buscarNomeUsuario().then((nome) => {
        titulo.textContent = `Olá, ${nome}! 👋`;
        });
    }

    const inicial = obterIntervaloPeriodo('mes-atual');
    if (inputInicio) inputInicio.value = inicial.dataInicio;
    if (inputFim) inputFim.value = inicial.dataFim;

    let rotuloPeriodo = 'Este mês';

    function dispararMudanca() {
        aoMudarPeriodo?.({
        dataInicio: inputInicio?.value || '',
        dataFim: inputFim?.value || '',
        rotulo: rotuloPeriodo,
        });
    }

    atalhos?.addEventListener('click', (evento) => {
        const botao = evento.target.closest('button[data-periodo]');
        if (!botao) return;
        for (const b of atalhos.querySelectorAll('.dashboard-pill')) {
        b.classList.toggle('ativo', b === botao);
        }
        rotuloPeriodo = botao.textContent.trim();
        const { dataInicio, dataFim } = obterIntervaloPeriodo(botao.dataset.periodo);
        if (inputInicio) inputInicio.value = dataInicio;
        if (inputFim) inputFim.value = dataFim;
        dispararMudanca();
    }, { signal });

    inputInicio?.addEventListener('change', () => {
        for (const b of atalhos.querySelectorAll('.dashboard-pill')) b.classList.remove('ativo');
        rotuloPeriodo = 'Período personalizado';
        dispararMudanca();
    }, { signal });

    inputFim?.addEventListener('change', () => {
        for (const b of atalhos.querySelectorAll('.dashboard-pill')) b.classList.remove('ativo');
        rotuloPeriodo = 'Período personalizado';
        dispararMudanca();
    }, { signal });

    return {
        lerPeriodo: () => ({
        dataInicio: inputInicio?.value || inicial.dataInicio,
        dataFim: inputFim?.value || inicial.dataFim,
        rotulo: rotuloPeriodo,
        }),
    };
}