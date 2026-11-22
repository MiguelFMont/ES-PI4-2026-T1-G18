// src/features/dashboard/components/DashboardCategorias/DashboardCategorias.js
import { formatarData, formatarMoeda } from '../../../transactions/utils/format.js';
import { CATEGORIAS, FORMAS_PAGAMENTO, rotuloDe } from '../../../transactions/utils/constants.js';
import { agruparGastos } from '../../utils/dashboardGrupos.js';

export function iniciarDashboardCategorias(raiz, { signal } = {}) {
    const btnCategoria = raiz.querySelector('#btn-visao-categoria');
    const btnGrupo = raiz.querySelector('#btn-visao-grupo');
    const subtituloGastos = raiz.querySelector('#dash-gastos-subtitulo');
    const svgDonut = raiz.querySelector('#dash-donut-svg');
    const donutValor = raiz.querySelector('#dash-donut-valor');
    const donutRotulo = raiz.querySelector('#dash-donut-rotulo');
    const legendaLista = raiz.querySelector('#dash-legenda-lista');
    const btnVerTodas = raiz.querySelector('#btn-ver-todas-categorias');
    const gaveta = raiz.querySelector('#dash-gaveta-transacoes');
    const msgVazio = raiz.querySelector('#dash-categorias-vazio');
    const corpoGastos = raiz.querySelector('#dash-gastos-corpo');
    const wrapperEvolucao = raiz.querySelector('.dashboard-linha-wrapper');
    const svgEvolucao = raiz.querySelector('#dash-evolucao-svg');
    const textoMentor = raiz.querySelector('#dash-mentor-texto');

    let modoVisao = 'categoria';
    let transacoesAtuais = [];
    let itemExpandidoId = null;
    let periodosCache = [];

    function alternarExpansao(id) {
        itemExpandidoId = itemExpandidoId === id ? null : id;
        renderizarDistribuicao();
    }

    function desenharDonut(itens, totalGeral) {
        svgDonut.replaceChildren();
        const raio = 80;
        const circunferencia = 2 * Math.PI * raio;
        let acumulado = 0;

        donutValor.textContent = formatarMoeda(totalGeral);
        donutRotulo.textContent = 'Total';

        for (const item of itens) {
        const fracao = totalGeral > 0 ? item.total / totalGeral : 0;
        const comprimento = Math.max(fracao * circunferencia - 2, 2);

        const fatia = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        fatia.setAttribute('cx', '110');
        fatia.setAttribute('cy', '110');
        fatia.setAttribute('r', String(raio));
        fatia.setAttribute('stroke', item.cor);
        fatia.setAttribute('stroke-width', itemExpandidoId === item.id ? '32' : '26');
        fatia.setAttribute('stroke-dasharray', `${comprimento} ${circunferencia - comprimento}`);
        fatia.setAttribute('stroke-dashoffset', String(-acumulado * circunferencia));
        fatia.setAttribute('class', `dashboard-donut-fatia ${itemExpandidoId === item.id ? 'ativa' : ''}`);

        fatia.addEventListener('mouseenter', () => {
            donutValor.textContent = formatarMoeda(item.total);
            donutRotulo.textContent = `${item.rotulo} (${item.percentual.toFixed(0)}%)`;
        });

        fatia.addEventListener('mouseleave', () => {
            const ativo = itens.find((i) => i.id === itemExpandidoId);
            if (ativo) {
            donutValor.textContent = formatarMoeda(ativo.total);
            donutRotulo.textContent = `${ativo.rotulo} (${ativo.percentual.toFixed(0)}%)`;
            } else {
            donutValor.textContent = formatarMoeda(totalGeral);
            donutRotulo.textContent = 'Total';
            }
        });

        fatia.addEventListener('click', () => alternarExpansao(item.id));
        svgDonut.append(fatia);
        acumulado += fracao;
        }
    }

    function desenharLegenda(itens) {
        legendaLista.replaceChildren(
        ...itens.map((item) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `dashboard-legenda-item ${itemExpandidoId === item.id ? 'ativo' : ''}`;
            btn.innerHTML = `
            <span class="dashboard-legenda-item__bolinha" style="background: ${item.cor}"></span>
            <span class="dashboard-legenda-item__nome">${item.rotulo}</span>
            <span class="dashboard-legenda-item__pct">${item.percentual.toFixed(0)}%</span>
            <span class="dashboard-legenda-item__valor valor-financeiro">${formatarMoeda(item.total)}</span>
            `;
            btn.addEventListener('click', () => alternarExpansao(item.id));
            li.append(btn);
            return li;
        })
        );
    }

    function desenharGavetaTransacoes(itens) {
        if (!itemExpandidoId) {
        gaveta.hidden = true;
        btnVerTodas.textContent = 'Ver todas as categorias e transações';
        return;
        }

        const selecionados = itemExpandidoId === '__TODAS__'
        ? itens
        : itens.filter((i) => i.id === itemExpandidoId);

        if (selecionados.length === 0) {
        gaveta.hidden = true;
        return;
        }

        gaveta.hidden = false;
        btnVerTodas.textContent = itemExpandidoId === '__TODAS__'
        ? 'Ocultar transações detalhadas'
        : 'Ver todas as categorias e transações';

        gaveta.replaceChildren(
        ...selecionados.map((grupo) => {
            const box = document.createElement('div');
            box.className = 'dashboard-gaveta-grupo';

            const topo = document.createElement('div');
            topo.className = 'dashboard-gaveta-grupo__titulo';
            topo.innerHTML = `
            <span>${grupo.icone} ${grupo.rotulo} (${grupo.transacoes.length})</span>
            <span class="valor-financeiro">${formatarMoeda(grupo.total)}</span>
            `;
            box.append(topo);

            for (const t of grupo.transacoes) {
            const linha = document.createElement('div');
            linha.className = 'dashboard-subtransacao';

            const dataEl = document.createElement('span');
            dataEl.className = 'dashboard-subtransacao__data';
            dataEl.textContent = formatarData(t.data);

            const descEl = document.createElement('span');
            descEl.className = 'dashboard-subtransacao__desc';
            descEl.textContent = t.descricao;

            const tagEl = document.createElement('span');
            tagEl.className = 'dashboard-subtransacao__tag';
            tagEl.textContent = `${rotuloDe(CATEGORIAS, t.categoria)} • ${rotuloDe(FORMAS_PAGAMENTO, t.formaPagamento)}`;

            const valorEl = document.createElement('span');
            valorEl.className = 'dashboard-subtransacao__valor valor-financeiro';
            valorEl.textContent = `− ${formatarMoeda(t.valor)}`;

            linha.append(dataEl, descEl, tagEl, valorEl);
            box.append(linha);
            }

            return box;
        })
        );
    }

    function atualizarInsightMentor(itens, totalGeral) {
        if (!textoMentor) return;
        if (itens.length === 0 || totalGeral <= 0) {
        textoMentor.textContent = 'Cadastre suas receitas e despesas para receber análises personalizadas do Mentor IA.';
        return;
        }
        const maior = itens[0];
        textoMentor.textContent =
        `Seus gastos com ${maior.rotulo} representam ${maior.percentual.toFixed(0)}% das despesas do período (${formatarMoeda(maior.total)}). Clique em uma categoria ao lado para revisar cada lançamento.`;
    }

    function renderizarDistribuicao() {
        const { itens, totalGeral } = agruparGastos(transacoesAtuais, modoVisao);

        if (itens.length === 0) {
        corpoGastos.hidden = true;
        msgVazio.hidden = false;
        atualizarInsightMentor([], 0);
        return;
        }

        msgVazio.hidden = true;
        corpoGastos.hidden = false;

        desenharDonut(itens, totalGeral);
        desenharLegenda(itens);
        desenharGavetaTransacoes(itens);
        atualizarInsightMentor(itens, totalGeral);
    }

    // Gráfico de Evolução Mensal com interatividade estilo Bolsa de Valores (Crosshair e tooltips)
    function desenharGraficoEvolucao(periodos = []) {
        if (!svgEvolucao) return;
        periodosCache = periodos.length > 0 ? periodos : [
        { rotulo: 'M-5', receitas: 0, despesas: 0 },
        { rotulo: 'M-4', receitas: 0, despesas: 0 },
        { rotulo: 'M-3', receitas: 0, despesas: 0 },
        { rotulo: 'M-2', receitas: 0, despesas: 0 },
        { rotulo: 'M-1', receitas: 0, despesas: 0 },
        { rotulo: 'Atual', receitas: 0, despesas: 0 },
        ];

        const largura = 520;
        const altura = 215;
        const padEsq = 54;
        const padDir = 18;
        const padTopo = 18;
        const padBase = 34;
        const areaL = largura - padEsq - padDir;
        const areaA = altura - padTopo - padBase;

        const maiorBruto = Math.max(
        1000,
        ...periodosCache.flatMap((p) => [Number(p.receitas || 0), Number(p.despesas || 0)])
        );
        const teto = Math.ceil(maiorBruto / 1000) * 1000;

        const xDe = (i) => padEsq + (periodosCache.length > 1 ? (i / (periodosCache.length - 1)) * areaL : areaL / 2);
        const yDe = (val) => padTopo + areaA - (Math.min(val, teto) / teto) * areaA;

        const formatarEixoY = (val) => (val === 0 ? 'R$ 0' : `R$ ${(val / 1000).toFixed(0)}k`);

        const niveis = [0, teto * 0.33, teto * 0.66, teto];
        let gradesSvg = '';
        for (const n of niveis) {
        const y = yDe(n).toFixed(1);
        gradesSvg += `
            <line x1="${padEsq}" y1="${y}" x2="${largura - padDir}" y2="${y}" stroke="var(--borda)" stroke-dasharray="3 3" stroke-width="1" />
            <text x="${padEsq - 8}" y="${Number(y) + 4}" text-anchor="end" fill="var(--texto-suave)" font-size="11" font-weight="600">${formatarEixoY(n)}</text>
        `;
        }

        const ptsRec = periodosCache.map((p, i) => `${xDe(i).toFixed(1)},${yDe(Number(p.receitas || 0)).toFixed(1)}`).join(' ');
        const ptsDesp = periodosCache.map((p, i) => `${xDe(i).toFixed(1)},${yDe(Number(p.despesas || 0)).toFixed(1)}`).join(' ');

        const base = (padTopo + areaA).toFixed(1);
        const areaRec = `${xDe(0).toFixed(1)},${base} ${ptsRec} ${xDe(periodosCache.length - 1).toFixed(1)},${base}`;
        const areaDesp = `${xDe(0).toFixed(1)},${base} ${ptsDesp} ${xDe(periodosCache.length - 1).toFixed(1)},${base}`;

        let pontosSvg = '';
        let rotulosX = '';

        periodosCache.forEach((p, i) => {
        const x = xDe(i).toFixed(1);
        const yR = yDe(Number(p.receitas || 0)).toFixed(1);
        const yD = yDe(Number(p.despesas || 0)).toFixed(1);
        const mesCurto = String(p.rotulo || '').split('/')[0];

        pontosSvg += `
            <circle cx="${x}" cy="${yR}" r="4.5" fill="var(--positivo)" class="ponto-grafico" data-index="${i}" />
            <circle cx="${x}" cy="${yD}" r="4.5" fill="var(--negativo)" class="ponto-grafico" data-index="${i}" />
        `;
        rotulosX += `
            <text x="${x}" y="${altura - 10}" text-anchor="middle" fill="var(--texto-suave)" font-size="11.5" font-weight="700">${mesCurto}</text>
        `;
        });

        svgEvolucao.innerHTML = `
        ${gradesSvg}
        <polygon points="${areaRec}" fill="var(--positivo)" opacity="0.12" />
        <polygon points="${areaDesp}" fill="var(--negativo)" opacity="0.12" />
        <polyline fill="none" stroke="var(--positivo)" stroke-width="2.5" points="${ptsRec}" />
        <polyline fill="none" stroke="var(--negativo)" stroke-width="2.5" points="${ptsDesp}" />
        
        <!-- Linha vertical de rastreio (crosshair) e círculos de destaque -->
        <line id="crosshair-linha" x1="0" y1="${padTopo}" x2="0" y2="${padTopo + areaA}" stroke="var(--destaque)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0" />
        <circle id="crosshair-ponto-rec" cx="0" cy="0" r="6" fill="none" stroke="var(--positivo)" stroke-width="2.5" opacity="0" />
        <circle id="crosshair-ponto-desp" cx="0" cy="0" r="6" fill="none" stroke="var(--negativo)" stroke-width="2.5" opacity="0" />

        ${pontosSvg}
        ${rotulosX}
        `;

        // Cria ou reutiliza o container flutuante do tooltip estilo bolsa de valores
        let tooltip = wrapperEvolucao.querySelector('.dashboard-grafico-tooltip');
        if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'dashboard-grafico-tooltip';
        wrapperEvolucao.style.position = 'relative';
        wrapperEvolucao.append(tooltip);
        }
        tooltip.hidden = true;

        const crosshairLinha = svgEvolucao.querySelector('#crosshair-linha');
        const crosshairRec = svgEvolucao.querySelector('#crosshair-ponto-rec');
        const crosshairDesp = svgEvolucao.querySelector('#crosshair-ponto-desp');

        svgEvolucao.onmousemove = (e) => {
        if (periodosCache.length === 0) return;
        const rect = svgEvolucao.getBoundingClientRect();
        const clickX = ((e.clientX - rect.left) / rect.width) * largura;

        if (clickX < padEsq || clickX > largura - padDir) {
            crosshairLinha.setAttribute('opacity', '0');
            crosshairRec.setAttribute('opacity', '0');
            crosshairDesp.setAttribute('opacity', '0');
            tooltip.hidden = true;
            return;
        }

        // Encontra o mês mais próximo do cursor
        let maisProximoIndex = 0;
        let menorDistancia = Infinity;
        periodosCache.forEach((_, i) => {
            const xPt = xDe(i);
            const dist = Math.abs(xPt - clickX);
            if (dist < menorDistancia) {
            menorDistancia = dist;
            maisProximoIndex = i;
            }
        });

        const p = periodosCache[maisProximoIndex];
        const xSnap = xDe(maisProximoIndex);
        const yR = yDe(Number(p.receitas || 0));
        const yD = yDe(Number(p.despesas || 0));

        crosshairLinha.setAttribute('x1', xSnap);
        crosshairLinha.setAttribute('x2', xSnap);
        crosshairLinha.setAttribute('opacity', '1');

        crosshairRec.setAttribute('cx', xSnap);
        crosshairRec.setAttribute('cy', yR);
        crosshairRec.setAttribute('opacity', '1');

        crosshairDesp.setAttribute('cx', xSnap);
        crosshairDesp.setAttribute('cy', yD);
        crosshairDesp.setAttribute('opacity', '1');

        // Posiciona e exibe o painel flutuante de valores (estilo bolsa de valores)
        const recVal = Number(p.receitas || 0);
        const despVal = Number(p.despesas || 0);
        const saldoMes = recVal - despVal;
        const corSaldo = saldoMes >= 0 ? 'var(--positivo)' : 'var(--negativo)';

        tooltip.innerHTML = `
            <div class="dashboard-tooltip-titulo">${p.rotulo}</div>
            <div class="dashboard-tooltip-linha"><span style="color: var(--positivo)">● Receitas:</span> <strong>${formatarMoeda(recVal)}</strong></div>
            <div class="dashboard-tooltip-linha"><span style="color: var(--negativo)">● Despesas:</span> <strong>${formatarMoeda(despVal)}</strong></div>
            <div class="dashboard-tooltip-linha"><span>Saldo:</span> <strong style="color: ${corSaldo}">${formatarMoeda(saldoMes)}</strong></div>
        `;
        tooltip.hidden = false;

        // Posiciona o tooltip próximo ao cursor sem sair da tela
        const pctX = (xSnap / largura) * 100;
        tooltip.style.left = `${pctX > 65 ? pctX - 38 : pctX + 4}%`;
        tooltip.style.top = '15%';
        };

        svgEvolucao.onmouseleave = () => {
        crosshairLinha.setAttribute('opacity', '0');
        crosshairRec.setAttribute('opacity', '0');
        crosshairDesp.setAttribute('opacity', '0');
        tooltip.hidden = true;
        };
    }

    btnCategoria?.addEventListener('click', () => {
        if (modoVisao === 'categoria') return;
        modoVisao = 'categoria';
        itemExpandidoId = null;
        btnCategoria.classList.add('ativo');
        btnCategoria.setAttribute('aria-selected', 'true');
        btnGrupo.classList.remove('ativo');
        btnGrupo.setAttribute('aria-selected', 'false');
        renderizarDistribuicao();
    }, { signal });

    btnGrupo?.addEventListener('click', () => {
        if (modoVisao === 'grupo') return;
        modoVisao = 'grupo';
        itemExpandidoId = null;
        btnGrupo.classList.add('ativo');
        btnGrupo.setAttribute('aria-selected', 'true');
        btnCategoria.classList.remove('ativo');
        btnCategoria.setAttribute('aria-selected', 'false');
        renderizarDistribuicao();
    }, { signal });

    btnVerTodas?.addEventListener('click', () => {
        alternarExpansao('__TODAS__');
    }, { signal });

    return {
        atualizar(transacoes, rotuloPeriodo = 'Este mês') {
        transacoesAtuais = transacoes;
        itemExpandidoId = null;
        if (subtituloGastos && rotuloPeriodo) subtituloGastos.textContent = rotuloPeriodo;
        renderizarDistribuicao();
        },
        atualizarEvolucaoMensal(periodos) {
        desenharGraficoEvolucao(periodos);
        },
    };
}