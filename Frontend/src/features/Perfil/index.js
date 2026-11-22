
import { incluirFragmentos } from '../../core/views/includes.js';
import { iniciarReportarProblema } from './components/ReportarProblema.js';
import { alternarEstilo, estiloAtual } from '../../core/theme/theme.js';
import { salvarPreferencias } from '../../core/preferencias.js';
import { notificar } from '../../shared/components/notificacao.js';
import { api, ApiError } from '../../core/http/api.js';

// Os nomes têm de bater letra a letra com os arquivos (pasta "Perfil", "visaoGeral.html", "MFA.html"): no Linux os
// caminhos diferenciam maiúsculas de minúsculas.
const CAMINHO = '/src/features/Perfil/components';

const FRAGMENTOS = {
    'visao-geral': 'visaoGeral.html',
    'perfil': 'perfil.html',
    'preferencias': 'preferencias.html',
    'seguranca': 'seguranca.html',
    'reportar-problema': 'ReportarProblema.html',
    'mfa': 'MFA.html'
};

let controlador = null;
let usuarioAtual = null;
let sequencia = 0;

// A mensagem do Backend (ex.: "Código MFA incorreto") quando ele respondeu; sem resposta, o aviso de conexão.
function mensagemDoErro(erro, padrao) {
    if (!(erro instanceof ApiError)) return padrao;
    if (erro.status === 0) return 'Não foi possível conectar ao servidor.';
    return erro.message || padrao;
}

// Sem sessão (ou com ela vencida) o api.js leva para o login.
async function buscarUsuario(signal) {
    return api('/auth/me', { signal });
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

        // Validação do campo Nome: fica como texto curto da própria tela.
        mensagem.textContent = '';

        if (!nome) {
            mensagem.textContent = 'Informe um nome válido.';
            return;
        }

        botao.disabled = true;
        botao.textContent = 'Salvando...';

        try {
            const usuarioAtualizado = await api('/auth/me', {
                method: 'PATCH',
                body: JSON.stringify({ nome }),
                signal
            });

            usuarioAtual = {
                ...usuarioAtual,
                ...usuarioAtualizado,
                nome
            };

            notificar('Nome atualizado com sucesso!', 'sucesso');

        } catch (erro) {
            if (signal.aborted) return;
            notificar(mensagemDoErro(erro, 'Não foi possível atualizar o nome.'), 'erro');
        } finally {
            botao.disabled = false;
            botao.textContent = 'Salvar alterações';
        }
    }, { signal });
}

function iniciarPreferencias(container, signal) {
    const interruptor = container.querySelector('#preferencia-estilo');
    const estado = container.querySelector('#preferencia-estilo-estado');
    const mensagem = container.querySelector('#preferencias-mensagem');

    // Ligado = com sombras (o padrão); desligado = com bordas finas.
    function mostrarEstilo() {
        const comSombras = estiloAtual() === 'sombras';
        interruptor.setAttribute('aria-checked', String(comSombras));
        estado.textContent = comSombras ? 'Com sombras' : 'Com bordas';
    }

    mostrarEstilo();

    interruptor.addEventListener('click', () => {
        const novo = alternarEstilo();
        mostrarEstilo();
        mensagem.textContent = '';

        // O estilo já vale neste navegador; o salvamento na conta é um extra e a falha não desfaz a troca.
        salvarPreferencias({ estilo: novo }).catch((erro) => {
            console.error('Erro ao salvar o estilo da interface:', erro);
            if (!signal.aborted) {
                mensagem.textContent = 'O estilo foi aplicado, mas não foi possível salvá-lo na sua conta.';
            }
        });
    }, { signal });
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

    // Um código errado é 401 INVALID_MFA_CODE: o api.js só encerra a sessão no 401 UNAUTHENTICATED, então a mensagem
    // fica nesta tela.
    async function requisicaoMFA(rota, codigo) {
        try {
            return await api(`/auth/mfa/${rota}`, {
                method: 'POST',
                ...(codigo !== undefined && {
                    body: JSON.stringify({ codigo })
                }),
                signal
            });
        } catch (erro) {
            if (signal.aborted) throw erro;
            throw new Error(mensagemDoErro(erro, 'Erro ao configurar MFA.'));
        }
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
            if (!signal.aborted) {
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
            if (!signal.aborted) {
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
            if (!signal.aborted) {
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
            iniciarPreferencias(container, signal);
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
