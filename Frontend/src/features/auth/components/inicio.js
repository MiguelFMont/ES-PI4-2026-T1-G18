import { notificar } from "../../../shared/components/notificacao.js";

// Tempo (ms) entre "login concluído" e a ida para o painel: é também a duração da linha de carregamento da notificação.
const ESPERA_REDIRECIONAMENTO_MS = 3000;
// Duração da notificação de cadastro, que tem um texto mais longo (precisa de tempo para ser lido).
const DURACAO_CADASTRO_MS = 8000;

var btnSignin = document.querySelector("#signin");
var btnSignup = document.querySelector("#signup");
var body = document.querySelector("body");

btnSignin.addEventListener("click", function () {
    body.className = "sign-in-js";
});

btnSignup.addEventListener("click", function () {
    body.className = "sign-up-js";
});


// Seleciona o formulário de login
const loginForm = document.querySelector("#login-form");
const loginEmail = document.querySelector("#login-email");
const loginSenha = document.querySelector("#login-senha");
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
        // Envia os dados para o Backend
        const resposta = await fetch("/v1/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });
        const resultado = await resposta.json();
        if (!resposta.ok) {
            if (resposta.status === 401) {
                notificar("E-mail ou senha incorretos.", "erro");
            } else {
                notificar("Não foi possível realizar o login. Tente novamente.", "erro");
            }
            return;
        }
        if (!resultado.token) {
            notificar("O servidor não retornou um token.", "erro");
            return;
        }
        // O token é salvo antes da espera: se a pessoa fechar a aba ou recarregar, o login já vale.
        localStorage.setItem("@FinanceAI:token", resultado.token);
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
        notificar("Não foi possível conectar ao servidor.", "erro");
        console.error("Erro no login:", error);
    } finally {
        // Durante o redirecionamento o botão continua desabilitado
        if (!redirecionando) loginBotao.disabled = false;
    }
});
// Seleciona o formulário de cadastro
const cadastroForm = document.querySelector("#cadastro-form");

const cadastroNome = document.querySelector("#cadastro-nome");
const cadastroEmail = document.querySelector("#cadastro-email");
const cadastroCpf = document.querySelector("#cadastro-cpf");
const cadastroSenha = document.querySelector("#cadastro-senha");
const cadastroBotao = cadastroForm.querySelector("button");

// REQUISITOS DA SENHA

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
            texto: "Pelo menos 1 letra maiúscula, 1 número e 1 caractere especial",
            valido: /[A-Z]/.test(senha) &&
                    /[0-9]/.test(senha) &&
                    /[^a-zA-Z0-9]/.test(senha)
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
        const resposta = await fetch("/v1/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

        const resultado = await resposta.json();
        if (!resposta.ok) {
            // Exibe a mensagem de erro retornada pelo servidor
            const mensagem = resultado.error?.details?.cpf?.[0]
            ||  resultado.error?.details?.senha?.[0] || resultado.message
            || resultado.error?.message;
            notificar(
                typeof mensagem === "string"
                    ? mensagem
                    : resposta.status === 409
                        ? "Este e-mail ou CPF já está cadastrado."
                        : "Não foi possível realizar o cadastro.",
                "erro"
            );
            return;
        }
        cadastroForm.reset();
        validarSenha("");
        // Exibe a tela de login após o cadastro
        notificar(
            resultado.mensagem || "Cadastro realizado! Enviamos um link de confirmação para seu e-mail. Verifique sua caixa de entrada.",
            "sucesso",
            { duracao: DURACAO_CADASTRO_MS }
        );

    } catch (error) {
        notificar("Não foi possível conectar ao servidor.", "erro");

        console.error("Erro no cadastro:", error);
    } finally {
        cadastroBotao.disabled = false;
    }
});
