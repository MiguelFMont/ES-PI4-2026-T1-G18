const CHAVE = '@FinanceAI:ocultarValores';
let ocultos = localStorage.getItem(CHAVE) === 'true';

// Elementos conhecidos que exibem valores financeiros.
const SELETORES_FINANCEIROS = [
    '#resumo-entradas',
    '#resumo-saidas',
    '#resumo-saldo'
];

function marcarValoresFinanceiros() {
    document.querySelectorAll(
        SELETORES_FINANCEIROS.join(',')
    ).forEach(elemento => {
        elemento.classList.add('valor-financeiro');
    });
}

export function iniciarOcultacaoValores() {
    const botao = document.querySelector('#botao-ocultar-valores');

    if (!botao) return;

    function atualizar() {
        botao.textContent = ocultos
            ? 'Mostrar valores'
            : 'Ocultar valores';

        botao.setAttribute('aria-pressed', String(ocultos));

        document.documentElement.classList.toggle(
            'valores-ocultos',
            ocultos
        );

        marcarValoresFinanceiros();
    }

    botao.addEventListener('click', () => {
        ocultos = !ocultos;
        localStorage.setItem(CHAVE, String(ocultos));
        atualizar();
    });

    // Identifica valores adicionados ao carregar outras telas.
    const observador = new MutationObserver(() => {
        marcarValoresFinanceiros();
    });

    observador.observe(document.querySelector('#app-content'), {
        childList: true,
        subtree: true
    });

    atualizar();
}
