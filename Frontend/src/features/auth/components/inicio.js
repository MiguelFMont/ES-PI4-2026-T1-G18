/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { notificar } from "../../../shared/components/notificacao.js";
import { api, ApiError } from "../../../core/http/api.js";
import { saveToken } from "../../../core/session/storage.js";
import { traduzirValidacaoNativa } from "../../../shared/utils/validacaoEmPortugues.js";

traduzirValidacaoNativa();

// Tempo (ms) entre "login concluído" e a ida para o painel: é também a duração da linha de carregamento da notificação.
const ESPERA_REDIRECIONAMENTO_MS = 3000;
// Duração da notificação de cadastro, que tem um texto mais longo (precisa de tempo para ser lido).
const DURACAO_CADASTRO_MS = 8000;
// Duração das mensagens de erro que pedem uma ação (confirmar o e-mail, esperar o limite de tentativas).
const DURACAO_AVISO_MS = 8000;

var btnSignin = document.querySelector("#signin");
var btnSignup = document.querySelector("#signup");
var body = document.querySelector("body");

btnSignin.addEventListener("click", function () {
    body.className = "sign-in-js";
});

btnSignup.addEventListener("click", function () {
    body.className = "sign-up-js";
});

// Sem resposta do Backend (rede, servidor fora do ar): o api.js devolve ApiError com status 0.
function semConexao(erro) {
    return !(erro instanceof ApiError) || erro.status === 0;
}

// Mensagem de erro do login com e-mail e senha, pelo `code` que o Backend devolve.
function mensagemDoLogin(erro) {
    if (semConexao(erro)) return "Não foi possível conectar ao servidor.";
    switch (erro.code) {
        case "INVALID_CREDENTIALS":
        case "VALIDATION_ERROR":
            return "E-mail ou senha incorretos.";
        case "EMAIL_NOT_VERIFIED":
            return "Confirme seu e-mail antes de entrar: abra o link que enviamos para a sua caixa de entrada.";
        case "TOO_MANY_REQUESTS":
            return erro.message;
        default:
            return "Não foi possível realizar o login. Tente novamente.";
    }
}

// Mensagem de erro da segunda etapa (código do aplicativo autenticador).
function mensagemDoMfa(erro) {
    if (semConexao(erro)) return "Não foi possível conectar ao servidor.";
    switch (erro.code) {
        case "INVALID_MFA_TOKEN":
            return "A verificação expirou. Entre de novo com seu e-mail e senha.";
        case "MFA_CODE_ALREADY_USED":
        case "TOO_MANY_REQUESTS":
            return erro.message;
        default:
            return "Código MFA incorreto ou expirado.";
    }
}

// Mensagem de erro do cadastro: primeiro a regra do campo que falhou (CPF, senha, e-mail), depois a do Backend
// (ex.: "E-mail já cadastrado", "CPF já cadastrado").
function mensagemDoCadastro(erro) {
    if (semConexao(erro)) return "Não foi possível conectar ao servidor.";
    const detalhes = erro.details || {};
    const doCampo = detalhes.cpf?.[0] || detalhes.senha?.[0] || detalhes.email?.[0] || detalhes.nome?.[0];
    if (doCampo) return doCampo;
    if (erro.status === 409 || erro.status === 429) return erro.message;
    return "Não foi possível realizar o cadastro.";
}

const duracaoDoErro = (erro) =>
    erro instanceof ApiError && (erro.code === "EMAIL_NOT_VERIFIED" || erro.code === "TOO_MANY_REQUESTS")
        ? { duracao: DURACAO_AVISO_MS }
        : {};

// Seleciona o formulário de login
const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginSenha = document.querySelector("#login-senha");
const modalMfa = document.querySelector("#modal-mfa");
const codigoMfa = document.querySelector("#codigo-mfa");
const confirmarMfa = document.querySelector("#confirmar-mfa");
const cancelarMfa = document.querySelector("#cancelar-mfa");
const mfaErro = document.querySelector("#mfa-erro");
const loginBotao = loginForm.querySelector('button[type="submit"]');
let redirecionando = false;

// Executa quando o usuário envia o formulário
loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();
    // Evita envio duplo (durante a requisição e durante a espera do redirecionamento)
    if (redirecionando || loginBotao.disabled) return;
    loginBotao.disabled = true;
    // Obtém os dados digitados
    const dados = {
        email: loginEmail.value.trim(),
        senha: loginSenha.value
    };
    try {
        let resultado;
        try {
            resultado = await api("/auth/login", { method: "POST", body: JSON.stringify(dados) });
        } catch (erro) {
            notificar(mensagemDoLogin(erro), "erro", duracaoDoErro(erro));
            return;
        }

        if (resultado?.mfaRequired) {
            if (!resultado.mfaToken) {
                notificar("Não foi possível iniciar a verificação MFA.", "erro");
                return;
            }
            const codigo = await solicitarCodigoMfa();
            if (codigo === null) {
                return;
            }
            try {
                resultado = await api("/auth/login/mfa", {
                    method: "POST",
                    body: JSON.stringify({ mfaToken: resultado.mfaToken, codigo })
                });
            } catch (erro) {
                notificar(mensagemDoMfa(erro), "erro", duracaoDoErro(erro));
                return;
            }
        }
        if (!resultado?.token) {
            notificar("O servidor não retornou um token.", "erro");
            return;
        }
        // O token é salvo antes da espera: se a pessoa fechar a aba ou recarregar, o login já vale.
        saveToken(resultado.token);
        redirecionando = true;
        notificar("Login concluído! Estamos levando você para o painel...", "sucesso", {
            duracao: ESPERA_REDIRECIONAMENTO_MS,
            pausavel: false
        });
        //qual rota recebe apos o login(exemplo trocar para a ofical)
        setTimeout(function () {
            window.location.href = "/#dashboard";
        }, ESPERA_REDIRECIONAMENTO_MS);

    } catch (error) {
        notificar("Não foi possível realizar o login. Tente novamente.", "erro");
        console.error("Erro no login:", error);
    } finally {
        // Durante o redirecionamento o botão continua desabilitado
        if (!redirecionando) loginBotao.disabled = false;
    }
});

function solicitarCodigoMfa() {
    return new Promise((resolve) => {
        modalMfa.classList.add("ativo");
        codigoMfa.value = "";
        mfaErro.textContent = "";
        codigoMfa.focus();

        function fechar(codigo) {
            modalMfa.classList.remove("ativo");
            confirmarMfa.removeEventListener("click", confirmar);
            cancelarMfa.removeEventListener("click", cancelar);
            codigoMfa.removeEventListener("keydown", teclaPressionada);
            resolve(codigo);
        }

        function confirmar() {
            const codigo = codigoMfa.value.trim();

            if (!/^\d{6}$/.test(codigo)) {
                mfaErro.textContent = "Digite um código válido de 6 dígitos.";
                return;
            }

            fechar(codigo);
        }

        function cancelar() {
            fechar(null);
        }

        function teclaPressionada(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                confirmar();
            }

            if (event.key === "Escape") {
                cancelar();
            }
        }

        confirmarMfa.addEventListener("click", confirmar);
        cancelarMfa.addEventListener("click", cancelar);
        codigoMfa.addEventListener("keydown", teclaPressionada);
    });
}
// Seleciona o formulário de cadastro
const cadastroForm = document.querySelector("#cadastro-form");

const cadastroNome = document.querySelector("#cadastro-nome");
const cadastroEmail = document.querySelector("#cadastro-email");
const cadastroCpf = document.querySelector("#cadastro-cpf");
const cadastroSenha = document.querySelector("#cadastro-senha");
const cadastroBotao = cadastroForm.querySelector("button");

// REQUISITOS DA SENHA (as mesmas regras do Backend, em Backend/src/modules/auth/auth.dto.ts): letras acentuadas
// contam como letras e qualquer símbolo (! @ # $ % - _ ...) conta como caractere especial; espaço não conta.

const reqTamanho = document.querySelector("#req-tamanho");
const reqComposicao = document.querySelector("#req-composicao");

function validarSenha(senha) {
    const requisitos = [
        {
            elemento: reqTamanho,
            texto: "Pelo menos 8 caracteres",
            valido: senha.length >= 8
        },
        {
            elemento: reqComposicao,
            texto: "Pelo menos 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial",
            valido: /\p{Ll}/u.test(senha) &&
                    /\p{Lu}/u.test(senha) &&
                    /\p{Nd}/u.test(senha) &&
                    /[^\p{L}\p{N}\s]/u.test(senha)
        }
    ];

    requisitos.forEach(function (requisito) {
        requisito.elemento.classList.toggle("valido", requisito.valido);

        requisito.elemento.textContent =
            (requisito.valido ? "✓ " : "○ ") + requisito.texto;
    });

    return requisitos.every(requisito => requisito.valido);
    }
    cadastroSenha.addEventListener("input", function () {
        validarSenha(cadastroSenha.value);
});

// Executa quando o usuário envia o cadastro
cadastroForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (cadastroBotao.disabled) return;
    const dados = {
        nome: cadastroNome.value.trim(),
        email: cadastroEmail.value.trim(),
        cpf: cadastroCpf.value.replace(/\D/g, ""),
        senha: cadastroSenha.value
    };

    if (!dados.nome || !dados.email || !dados.cpf || !dados.senha) {
        notificar("Preencha todos os campos.", "aviso");
        return;
    }
    if (dados.cpf.length !== 11) {
        notificar("O CPF deve conter 11 dígitos.", "aviso");
        return;
    }
    if (!validarSenha(dados.senha)) {
        notificar("Sua senha não atende a todos os requisitos.", "aviso");
        return;
    }
    cadastroBotao.disabled = true;
    try {
        const resultado = await api("/auth/register", { method: "POST", body: JSON.stringify(dados) });

        cadastroForm.reset();
        validarSenha("");
        // Exibe a tela de login após o cadastro
        notificar(
            resultado?.mensagem || "Cadastro realizado! Enviamos um link de confirmação para seu e-mail. Verifique sua caixa de entrada.",
            "sucesso",
            { duracao: DURACAO_CADASTRO_MS }
        );

    } catch (erro) {
        notificar(mensagemDoCadastro(erro), "erro", duracaoDoErro(erro));
        if (semConexao(erro)) console.error("Erro no cadastro:", erro);
    } finally {
        cadastroBotao.disabled = false;
    }
});
