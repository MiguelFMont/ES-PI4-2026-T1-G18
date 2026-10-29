const formatadorBRL = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

export function iniciarDashboardResumo(dados = {}) {
    const container = document.querySelector('#dashboard-resumo');
    if (!container) return;

    const saldo = Number(dados.saldo ?? 0);
    const despesas = Number(dados.despesas ?? dados.gastos ?? 0);
    const receitas = Number(dados.receitas ?? 0);

    const elSaldo = container.querySelector('#card-saldo');
    const elDespesas = container.querySelector('#card-despesas');
    const elReceitas = container.querySelector('#card-receitas');

    elSaldo.textContent = formatadorBRL.format(saldo);
    elSaldo.classList.remove('resumo-card__valor--positivo', 'resumo-card__valor--negativo');
    elSaldo.classList.add(saldo >= 0 ? 'resumo-card__valor--positivo' : 'resumo-card__valor--negativo');

    elDespesas.textContent = formatadorBRL.format(despesas);
    elReceitas.textContent = formatadorBRL.format(receitas);

    container.hidden = false;
}