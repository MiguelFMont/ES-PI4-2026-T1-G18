export function mostrarEstadoDashboard({ tipo = 'oculto', mensagem = '', aoTentarNovamente = null } = {}) {
    const box = document.querySelector('#dashboard-estado');
    const texto = document.querySelector('#dashboard-estado-msg');
    const botao = document.querySelector('#dashboard-estado-btn');
    const resumo = document.querySelector('#dashboard-resumo');

    if (!box || !texto || !botao) return;

    if (tipo === 'oculto') {
        box.hidden = true;
        return;
    }

    if (resumo) resumo.hidden = true;
    box.hidden = false;
    box.classList.toggle('dashboard-estado--erro', tipo === 'erro');
    texto.textContent = mensagem;

    if (tipo === 'erro' && typeof aoTentarNovamente === 'function') {
        botao.hidden = false;
        botao.onclick = aoTentarNovamente;
    } else {
        botao.hidden = true;
        botao.onclick = null;
    }
}