// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
import { formatarMoeda } from '../../../transactions/utils/format.js';

export function iniciarDashboardComparacao(raiz, { aoMudarTipo, signal } = {}) {
    const areaComp = raiz.querySelector('#dash-comparacao-conteudo');
    const botoes = raiz.querySelector('#dash-comparacao-botoes');

    botoes?.addEventListener('click', (evento) => {
        const botao = evento.target.closest('button[data-comp]');
        if (!botao) return;
        for (const b of botoes.querySelectorAll('.dashboard-pill')) {
        b.classList.toggle('ativo', b === botao);
        }
        aoMudarTipo?.(botao.dataset.comp);
    }, { signal });

    return {
        mostrar(dados) {
        const periodos = dados?.periodos ?? [];
        const maiorValor = Math.max(
            1,
            ...periodos.flatMap((p) => [Number(p.receitas || 0), Number(p.despesas || 0)])
        );

        areaComp.replaceChildren(
            ...periodos.map((p) => {
            const card = document.createElement('article');
            card.className = 'dashboard-mes-card';
            const pctRec = Math.round((Number(p.receitas || 0) / maiorValor) * 100);
            const pctDesp = Math.round((Number(p.despesas || 0) / maiorValor) * 100);
            const varDesp = Number(p.variacaoDespesas || 0);
            const sinalVar = varDesp > 0 ? `+${varDesp}%` : `${varDesp}%`;

            card.innerHTML = `
                <div class="dashboard-mes-card__topo">
                <span class="dashboard-mes-card__rotulo">${p.rotulo}</span>
                <span class="dashboard-badge ${
                    varDesp > 5 ? 'dashboard-badge--alta' : varDesp < -5 ? 'dashboard-badge--queda' : 'dashboard-badge--neutra'
                }">${sinalVar} despesas</span>
                </div>
                <div class="dashboard-mes-card__barras">
                <div class="dashboard-mes-linha">
                    <div class="dashboard-mes-linha__topo">
                    <span>Receitas</span>
                    <strong class="valor-financeiro">${formatarMoeda(p.receitas || 0)}</strong>
                    </div>
                    <div class="dashboard-barra-trilha">
                    <div class="dashboard-barra-preenchimento" style="width: ${pctRec}%; background: var(--positivo)"></div>
                    </div>
                </div>
                <div class="dashboard-mes-linha">
                    <div class="dashboard-mes-linha__topo">
                    <span>Despesas</span>
                    <strong class="valor-financeiro">${formatarMoeda(p.despesas || 0)}</strong>
                    </div>
                    <div class="dashboard-barra-trilha">
                    <div class="dashboard-barra-preenchimento" style="width: ${pctDesp}%; background: var(--negativo)"></div>
                    </div>
                </div>
                </div>
            `;
            return card;
            })
        );
        },
    };
}