
import { incluirFragmentos } from '../../core/views/includes.js';

const CAMINHO = '/src/features/perfil/components';

const FRAGMENTOS = {
    'visao-geral': 'VisaoGeral.html',
    'perfil': 'perfil.html',
    'preferencias': 'preferencias.html',
    'seguranca': 'seguranca.html'
};

let controlador = null;
let usuarioAtual = null;
let sequencia = 0;

async function buscarUsuario(signal) {
    const token = localStorage.getItem('@FinanceAI:token');

    if (!token) {
        throw new Error('Usuário não autenticado.');
    }

    const resposta = await fetch('/v1/auth/me', {
        headers: {
            Authorization: `Bearer ${token}`
        },
        signal
    });

    if (!resposta.ok) {
        throw new Error('Não foi possível carregar o perfil.');
    }

    return resposta.json();
}

function preencherVisaoGeral(container) {
    if (!usuarioAtual) return;

    const nome = usuarioAtual.nome || 'Usuário';
    const plano = usuarioAtual.plano === 'pro' ? 'Pro' : 'Free';

    container.querySelector('#usuario-nome').textContent = nome;
    container.querySelector('#usuario-email').textContent =
        usuarioAtual.email || '';
    container.querySelector('#usuario-inicial').textContent =
        nome.charAt(0).toUpperCase();
    container.querySelector('#usuario-plano').textContent =
        `Plano ${plano}`;
}

function preencherPerfil(container) {
    if (!usuarioAtual) return;

    container.querySelector('#perfil-nome').value =
        usuarioAtual.nome || '';
    container.querySelector('#perfil-email').value =
        usuarioAtual.email || '';
    container.querySelector('#perfil-plano').value =
        usuarioAtual.plano === 'pro' ? 'Pro' : 'Free';
}

function iniciarPreferencias(container) {
    const tema = container.querySelector('#preferencia-tema');
    const ocultar = container.querySelector('#preferencia-ocultar-valores');
    const mensagem = container.querySelector('#preferencias-mensagem');

    // Aguardando integração com o theme.js e o Backend.
    tema.disabled = true;
    ocultar.disabled = true;

    mensagem.textContent =
        'Configurações disponíveis após integração com o Backend.';
}

async function carregarAba(container, aba, signal) {
    const arquivo = FRAGMENTOS[aba];

    if (!arquivo) return;

    const minhaSequencia = ++sequencia;
    const conteudo = container.querySelector('#conteudo-minha-conta');

    try {
        const resposta = await fetch(`${CAMINHO}/${arquivo}`, {
            signal
        });

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar a aba.');
        }

        const html = await resposta.text();

        if (signal.aborted || minhaSequencia !== sequencia) return;

        conteudo.innerHTML = html;

        container.querySelectorAll('[data-aba]').forEach(botao => {
            const ativa = botao.dataset.aba === aba;
            botao.classList.toggle('ativo', ativa);
            botao.setAttribute('aria-pressed', String(ativa));
        });

        if (aba === 'visao-geral') {
            preencherVisaoGeral(container);
        } else if (aba === 'perfil') {
            preencherPerfil(container);
        } else if (aba === 'preferencias') {
            iniciarPreferencias(container);
        }

    } catch (erro) {
        if (erro.name === 'AbortError' || signal.aborted) return;
        conteudo.textContent = erro.message;
    }
}

export async function montar(container) {
    controlador = new AbortController();
    const { signal } = controlador;

    await incluirFragmentos(container);

    if (signal.aborted) return;

    container.addEventListener('click', evento => {
        const botao = evento.target.closest('[data-aba], [data-destino]');

        if (!botao || !container.contains(botao)) return;

        const aba = botao.dataset.aba || botao.dataset.destino;
        carregarAba(container, aba, signal);
    }, { signal });

    try {
        usuarioAtual = await buscarUsuario(signal);
    } catch (erro) {
        if (signal.aborted) return;
        console.error('Erro ao buscar usuário:', erro);
    }

    if (signal.aborted) return;

    await carregarAba(container, 'visao-geral', signal);
}

export function desmontar() {
    controlador?.abort();
    controlador = null;
    usuarioAtual = null;
    sequencia++;
}
