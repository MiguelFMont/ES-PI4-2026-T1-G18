// src/features/dashboard/components/DashboardResumo/DashboardResumo.js
import { formatarMoeda } from '../../../transactions/utils/format.js';

export function iniciarDashboardResumo(raiz) {
    const elSaldo = raiz.querySelector('#resumo-saldo');
    const elEntradas = raiz.querySelector('#resumo-entradas');
    const elSaidas = raiz.querySelector('#resumo-saidas');
    const elEconomia = raiz.querySelector('#dash-kpi-economia');

    const elSaldoVar = raiz.querySelector('#dash-kpi-saldo-var');
    const elRecVar = raiz.querySelector('#dash-kpi-receitas-var');
    const elDespVar = raiz.querySelector('#dash-kpi-despesas-var');
    const elMetaTexto = raiz.querySelector('#dash-kpi-meta-texto');
    const elMetaBarra = raiz.querySelector('#dash-kpi-meta-barra');

    function formatarTextoVariacao(valor) {
        const num = Number(valor || 0);
        const sinal = num > 0 ? '+' : '';
        return `${sinal}${num.toFixed(0)}% vs mês anterior`;
    }

    return {
        atualizarPorTransacoes(transacoes) {
        const receitas = transacoes.filter((t) => t.tipo === 'receita');
        const despesas = transacoes.filter((t) => t.tipo === 'despesa');

        const totalRec = receitas.reduce((acc, t) => acc + Number(t.valor || 0), 0);
        const totalDesp = despesas.reduce((acc, t) => acc + Number(t.valor || 0), 0);
        const saldo = totalRec - totalDesp;

        // Meta de economia sugerida: 30% das receitas (ou R$ 1.000,00 caso ainda não haja receita no período)
        const metaAlvo = totalRec > 0 ? totalRec * 0.3 : 1000;
        const economizado = Math.max(0, saldo);
        const pctMeta = Math.min(100, Math.max(0, Math.round((economizado / metaAlvo) * 100)));

        if (elSaldo) elSaldo.textContent = formatarMoeda(saldo);
        if (elEntradas) elEntradas.textContent = formatarMoeda(totalRec);
        if (elSaidas) elSaidas.textContent = formatarMoeda(totalDesp);
        if (elEconomia) elEconomia.textContent = formatarMoeda(economizado);

        if (elMetaTexto) elMetaTexto.textContent = `${pctMeta}% da meta`;
        if (elMetaBarra) elMetaBarra.style.width = `${pctMeta}%`;
        },

        atualizarVariacoes(periodos = []) {
        const ultimo = periodos[periodos.length - 1];
        if (!ultimo) return;

        const varSaldo = Number(ultimo.variacaoSaldo || 0);
        const varRec = Number(ultimo.variacaoReceitas || 0);
        const varDesp = Number(ultimo.variacaoDespesas || 0);

        if (elSaldoVar) {
            elSaldoVar.textContent = formatarTextoVariacao(varSaldo);
            elSaldoVar.className = `dashboard-kpi__variacao ${
            varSaldo >= 0 ? 'dashboard-kpi__variacao--positiva' : 'dashboard-kpi__variacao--negativa'
            }`;
        }

        if (elRecVar) {
            elRecVar.textContent = formatarTextoVariacao(varRec);
            elRecVar.className = `dashboard-kpi__variacao ${
            varRec >= 0 ? 'dashboard-kpi__variacao--positiva' : 'dashboard-kpi__variacao--negativa'
            }`;
        }

        if (elDespVar) {
            elDespVar.textContent = formatarTextoVariacao(varDesp);
            // Para despesas, subir (+) fica vermelho e cair (-) fica verde, igual na foto!
            elDespVar.className = `dashboard-kpi__variacao ${
            varDesp > 0 ? 'dashboard-kpi__variacao--negativa' : 'dashboard-kpi__variacao--positiva'
            }`;
        }
        },

        definirTendencia() {},
    };
}