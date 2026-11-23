// CEZAR AUGUSTO FERNANDEZ RULL - 25007452
export function mostrarEstadoDashboard(raiz, { tipo = 'oculto', mensagem = '', aoTentarNovamente = null } = {}) {
    const box = raiz.querySelector('#dashboard-estado-box');
    const texto = raiz.querySelector('#dashboard-estado-texto');
    const botao = raiz.querySelector('#dashboard-tentar-novamente');
    if (!box) return;

    if (tipo === 'oculto') {
        box.hidden = true;
        return;
    }

    box.hidden = false;
    texto.textContent = mensagem;

    if (tipo === 'erro' && typeof aoTentarNovamente === 'function') {
        botao.hidden = false;
        botao.onclick = aoTentarNovamente;
    } else {
        botao.hidden = true;
        botao.onclick = null;
    }
}