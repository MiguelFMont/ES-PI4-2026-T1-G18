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
const loginErro = document.querySelector("#login-erro");

// Executa quando o usuário envia o formulário
loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();
    loginErro.textContent = "";
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
            loginErro.textContent =
                resultado.message || "Não foi possível realizar o login.";
            return;
        }
        console.log("Login realizado com sucesso!");
        //armazenar o token e redirecionar
    } catch (error) {
        loginErro.textContent =
            "Não foi possível conectar ao servidor.";
        console.error("Erro no login:", error);
    }
});
// Seleciona o formulário de cadastro
const cadastroForm = document.querySelector("#cadastro-form");

const cadastroNome = document.querySelector("#cadastro-nome");
const cadastroEmail = document.querySelector("#cadastro-email");
const cadastroCpf = document.querySelector("#cadastro-cpf");
const cadastroSenha = document.querySelector("#cadastro-senha");
const cadastroErro = document.querySelector("#cadastro-erro");

// Executa quando o usuário envia o cadastro
cadastroForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    cadastroErro.textContent = "";
    const dados = {
        nome: cadastroNome.value.trim(),
        email: cadastroEmail.value.trim(),
        cpf: cadastroCpf.value.replace(/\D/g, ""),
        senha: cadastroSenha.value
    };

    if (!dados.nome || !dados.email || !dados.cpf || !dados.senha) {
        cadastroErro.textContent = "Preencha todos os campos.";
        return;
    }
    if (dados.cpf.length !== 11) {
        cadastroErro.textContent = "O CPF deve conter 11 dígitos.";
        return;
    }
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
            cadastroErro.textContent =
                resultado.message ||
                resultado.error ||
                "Não foi possível realizar o cadastro.";
            return;
        }
        cadastroForm.reset();
        // Exibe a tela de login após o cadastro
        body.className = "sign-in-js";

    } catch (error) {
        cadastroErro.textContent =
            "Não foi possível conectar ao servidor.";

        console.error("Erro no cadastro:", error);
    }
});
