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
            if (resposta.status === 401) {
                loginErro.textContent = "E-mail ou senha incorretos.";
            } else {
                 loginErro.textContent = "Não foi possível realizar o login. Tente novamente.";
            }    
            return;
        }
        if (!resultado.token) {
            loginErro.textContent = "O servidor não retornou um token.";
            return;
        }
        sessionStorage.setItem("token", resultado.token);
        //qual rota recebe apos o login(exemplo trocar para a ofical)
        window.location.href = "/#dashboard";

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
            const mensagem = resultado.error?.message || resultado.message;
            cadastroErro.textContent =
                typeof mensagem === "string"
                    ? mensagem
                    : resposta.status === 409
                        ? "Este e-mail ou CPF já está cadastrado."
                        : "Não foi possível realizar o cadastro.";
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
