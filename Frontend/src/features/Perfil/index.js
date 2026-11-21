
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarReportarProblema } from './components/ReportarProblema.js';
const CAMINHO = '/src/features/perfil/components';

const FRAGMENTOS = {
    'visao-geral': 'VisaoGeral.html',
    'perfil': 'perfil.html',
    'preferencias': 'preferencias.html',
    'seguranca': 'seguranca.html',
    'reportar-problema': 'ReportarProblema.html',
    'mfa': 'mfa.html'
    
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

function iniciarEdicaoPerfil(container, signal) {
    const formulario = container.querySelector('#formulario-perfil');
    const nomeInput = container.querySelector('#perfil-nome');
    const mensagem = container.querySelector('#perfil-mensagem');
    const botao = container.querySelector('#salvar-perfil');

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const nome = nomeInput.value.trim();

        if (!nome) {
            mensagem.textContent = 'Informe um nome válido.';
            return;
        }

        botao.disabled = true;
        mensagem.textContent = 'Salvando...';

        try {
            const token = localStorage.getItem('@FinanceAI:token');

            const resposta = await fetch('/v1/auth/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ nome }),
                signal
            });

            if (!resposta.ok) {
                throw new Error('Não foi possível atualizar o nome.');
            }

            const usuarioAtualizado = await resposta.json();

            usuarioAtual = {
                ...usuarioAtual,
                ...usuarioAtualizado,
                nome
            };

            mensagem.textContent = 'Nome atualizado com sucesso!';

        } catch (erro) {
            if (erro.name === 'AbortError') return;
            mensagem.textContent = erro.message;
        } finally {
            botao.disabled = false;
        }
    }, { signal });
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

function iniciarSeguranca(container, signal) {
    const status = container.querySelector('#mfa-status');
    const mensagem = container.querySelector('#mfa-mensagem');
    const botaoAtivar = container.querySelector('#ativar-mfa');
    const configuracao = container.querySelector('#mfa-configuracao');
    const desativacao = container.querySelector('#mfa-desativacao');
    const botaoConfirmar = container.querySelector('#confirmar-mfa');
    const botaoDesativar = container.querySelector('#desativar-mfa');
    const codigoInput = container.querySelector('#mfa-codigo');
    const codigoDesativarInput = container.querySelector('#mfa-codigo-desativar');
    const qrCode = container.querySelector('#mfa-qrcode');

    if (!usuarioAtual) {
        status.textContent = 'Não foi possível identificar o usuário.';
        return;
    }

    function atualizarEstado(ativo) {
        status.textContent = ativo ? 'MFA ativado' : 'MFA desativado';
        botaoAtivar.hidden = ativo;
        configuracao.hidden = true;
        desativacao.hidden = !ativo;
        qrCode.replaceChildren();
    }

    async function requisicaoMFA(rota, codigo) {
        const token = localStorage.getItem('@FinanceAI:token');

        const resposta = await fetch(`/v1/auth/mfa/${rota}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            ...(codigo !== undefined && {
                body: JSON.stringify({ codigo })
            }),
            signal
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.message || dados.mensagem || 'Erro ao configurar MFA.');
        }

        return dados;
    }

    atualizarEstado(Boolean(usuarioAtual.mfaEnabled));

    botaoAtivar.addEventListener('click', async () => {
        botaoAtivar.disabled = true;
        mensagem.textContent = 'Gerando configuração MFA...';

        try {
            const dados = await requisicaoMFA('enable');

            botaoAtivar.hidden = true;
            configuracao.hidden = false;

            // Mostra a URI temporariamente até integrarmos o QR Code.
            const QRCode = (await import(
                '../../core/vendor/qrcode.js')).default;

            const imagem = document.createElement('img');

            imagem.src = await QRCode.toDataURL(dados.uri, {
                width: 220,
                margin: 2
            });

            imagem.alt = 'QR Code para configurar o autenticador FinanceAI';
            qrCode.replaceChildren(imagem);

            mensagem.textContent = 'Digite o código do aplicativo autenticador.';
        } catch (erro) {
            if (erro.name !== 'AbortError') {
                mensagem.textContent = erro.message;
            }
        } finally {
            botaoAtivar.disabled = false;
        }
    }, { signal });

    botaoConfirmar.addEventListener('click', async () => {
        const codigo = codigoInput.value.trim();

        if (!/^\d{6}$/.test(codigo)) {
            mensagem.textContent = 'Digite um código de 6 dígitos.';
            return;
        }

        botaoConfirmar.disabled = true;

        try {
            const dados = await requisicaoMFA('validate', codigo);

            usuarioAtual.mfaEnabled = dados.mfaEnabled;
            atualizarEstado(true);
            mensagem.textContent = 'MFA ativado com sucesso!';
        } catch (erro) {
            if (erro.name !== 'AbortError') {
                mensagem.textContent = erro.message;
            }
        } finally {
            botaoConfirmar.disabled = false;
        }
    }, { signal });

    botaoDesativar.addEventListener('click', async () => {
        const codigo = codigoDesativarInput.value.trim();

        if (!/^\d{6}$/.test(codigo)) {
            mensagem.textContent = 'Digite um código de 6 dígitos.';
            return;
        }

        botaoDesativar.disabled = true;

        try {
            const dados = await requisicaoMFA('disable', codigo);

            usuarioAtual.mfaEnabled = dados.mfaEnabled;
            atualizarEstado(false);
            mensagem.textContent = 'MFA desativado com sucesso!';
        } catch (erro) {
            if (erro.name !== 'AbortError') {
                mensagem.textContent = erro.message;
            }
        } finally {
            botaoDesativar.disabled = false;
        }
    }, { signal });
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
            iniciarEdicaoPerfil(container, signal);
        } else if (aba === 'preferencias') {
            iniciarPreferencias(container);
        } else if (aba === 'mfa') {
            iniciarSeguranca(container, signal);
        }else if (aba === 'reportar-problema') {
            iniciarReportarProblema();
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
