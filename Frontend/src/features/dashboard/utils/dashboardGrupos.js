// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
import { CATEGORIAS, rotuloDe } from '../../transactions/utils/constants.js';

export const META_CATEGORIAS = {
    Moradia:     { rotulo: 'Moradia',     icone: '🏠', cor: '#38bdf8' },
    Transporte:  { rotulo: 'Transporte',  icone: '🚗', cor: '#f59e0b' },
    Alimentacao: { rotulo: 'Alimentação', icone: '🍽️', cor: '#c6f432' },
    Lazer:       { rotulo: 'Lazer',       icone: '🎉', cor: '#a78bfa' },
    Saude:       { rotulo: 'Saúde',       icone: '💊', cor: '#f87171' },
    Educacao:    { rotulo: 'Educação',    icone: '🎓', cor: '#4ade80' },
    Outros:      { rotulo: 'Outros',      icone: '🛍️', cor: '#fb923c' },
    Salario:     { rotulo: 'Salário',     icone: '💼', cor: '#2dd4bf' },
};

export const META_GRUPOS_BB = {
    CarroMobilidade: {
        id: 'CarroMobilidade',
        rotulo: 'Carro & Mobilidade',
        descricao: 'Combustível, manutenção, estacionamento, Uber e transporte',
        icone: '🚗',
        cor: '#f59e0b',
    },
    CasaMoradia: {
        id: 'CasaMoradia',
        rotulo: 'Casa & Moradia',
        descricao: 'Aluguel, condomínio, luz, água, internet e contas da casa',
        icone: '🏠',
        cor: '#38bdf8',
    },
    ConsumoPessoal: {
        id: 'ConsumoPessoal',
        rotulo: 'Consumo Pessoal & Lazer',
        descricao: 'Compras pessoais, lazer, vestuário, assinaturas e outros',
        icone: '🛍️',
        cor: '#a78bfa',
    },
    AlimentacaoMercado: {
        id: 'AlimentacaoMercado',
        rotulo: 'Alimentação & Mercado',
        descricao: 'Supermercado, padaria, restaurantes e delivery',
        icone: '🍽️',
        cor: '#c6f432',
    },
    SaudeEducacao: {
        id: 'SaudeEducacao',
        rotulo: 'Saúde & Educação',
        descricao: 'Farmácia, exames, faculdade, livros e cursos',
        icone: '🎓',
        cor: '#4ade80',
    },
};

export function classificarDestinoBB(transacao) {
    const cat = transacao.categoria;
    const texto = `${transacao.descricao ?? ''} ${transacao.observacoes ?? ''}`.toLowerCase();

    if (
        cat === 'Transporte' ||
        /carro|combust|gasolina|etanol|ipva|oficina|mecanico|pneu|pedagio|estacionamento|uber|99|onibus|metro|polo|nivus/.test(texto)
    ) {
        return 'CarroMobilidade';
    }

    if (
        cat === 'Moradia' ||
        /aluguel|condominio|energia|luz|agua|gas|internet|iptu|casa|reforma|moveis/.test(texto)
    ) {
        return 'CasaMoradia';
    }

    if (cat === 'Alimentacao') return 'AlimentacaoMercado';
    if (cat === 'Saude' || cat === 'Educacao') return 'SaudeEducacao';

    return 'ConsumoPessoal';
}

export function agruparGastos(transacoes, modoVisao = 'grupo') {
    const despesas = transacoes.filter((t) => t.tipo === 'despesa');
    const totalGeral = despesas.reduce((acc, t) => acc + Number(t.valor || 0), 0);
    const mapa = new Map();

    for (const t of despesas) {
        const chave = modoVisao === 'grupo' ? classificarDestinoBB(t) : (t.categoria || 'Outros');
        const meta = modoVisao === 'grupo'
        ? META_GRUPOS_BB[chave]
        : (META_CATEGORIAS[chave] ?? { rotulo: rotuloDe(CATEGORIAS, chave), descricao: 'Categoria de despesa', icone: '📌', cor: '#9aa1b2' });

        if (!mapa.has(chave)) {
        mapa.set(chave, {
            id: chave,
            rotulo: meta.rotulo,
            descricao: meta.descricao ?? '',
            icone: meta.icone,
            cor: meta.cor,
            total: 0,
            transacoes: [],
        });
        }

        const grupo = mapa.get(chave);
        grupo.total += Number(t.valor || 0);
        grupo.transacoes.push(t);
    }

    const itens = [...mapa.values()]
        .sort((a, b) => b.total - a.total)
        .map((item) => ({
        ...item,
        percentual: totalGeral > 0 ? (item.total / totalGeral) * 100 : 0,
        transacoes: item.transacoes.sort((a, b) => String(b.data).localeCompare(String(a.data))),
        }));

    return { itens, totalGeral };
}

export function obterIntervaloPeriodo(atalho) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();

    let inicio;
    let fim = new Date(ano, mes + 1, 0);

    if (atalho === 'mes-atual') {
        inicio = new Date(ano, mes, 1);
    } else if (atalho === 'mes-anterior') {
        inicio = new Date(ano, mes - 1, 1);
        fim = new Date(ano, mes, 0);
    } else if (atalho === '3meses') {
        inicio = new Date(ano, mes - 2, 1);
    } else if (atalho === '6meses') {
        inicio = new Date(ano, mes - 5, 1);
    } else if (atalho === 'ytd') {
        inicio = new Date(ano, 0, 1);
    } else {
        inicio = new Date(ano, mes, 1);
    }

    const formatarIso = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return { dataInicio: formatarIso(inicio), dataFim: formatarIso(fim) };
}