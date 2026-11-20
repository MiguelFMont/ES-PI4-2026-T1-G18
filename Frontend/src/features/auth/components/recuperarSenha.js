import { notificar } from "../../../shared/components/notificacao.js";

const recuperarForm = document.querySelector("#recuperar-form");
const recuperarEmail = document.querySelector("#recuperar-email");
const recuperarBotao = recuperarForm.querySelector('button[type="submit"]');

recuperarForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (recuperarBotao.disabled) return;
    recuperarBotao.disabled = true;

    const dados = {
        email: recuperarEmail.value.trim()
    };

    try {
        const resposta = await fetch("/v1/auth/forgot-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            notificar("Não foi possível solicitar a recuperação.", "erro");
            return;
        }

        notificar(
            resultado.message || "Se o e-mail estiver cadastrado, enviaremos as instruções para redefinir a senha.",
            "sucesso",
            { duracao: 8000 }
        );
    } catch (error) {
        notificar("Não foi possível conectar ao servidor.", "erro");
        console.error("Erro na recuperação:", error);
    } finally {
        recuperarBotao.disabled = false;
    }
});
const parametros = new URLSearchParams(window.location.search);
const origem = parametros.get("origem");
const botaoVoltar = document.querySelector("#btn-voltar");
if (botaoVoltar) {
    if (origem === "perfil") {
        botaoVoltar.textContent = "Voltar para o perfil";
        botaoVoltar.href = "/#perfil";
    } else {
        botaoVoltar.textContent = "Voltar ao login";
        botaoVoltar.href = "/src/features/auth/components/inicio.html";
    }
}
