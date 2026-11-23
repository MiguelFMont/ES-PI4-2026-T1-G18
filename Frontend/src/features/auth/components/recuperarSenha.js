import { notificar } from "../../../shared/components/notificacao.js";
import { api, ApiError } from "../../../core/http/api.js";
import { traduzirValidacaoNativa } from "../../../shared/utils/validacaoEmPortugues.js";

traduzirValidacaoNativa();

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
        const resultado = await api("/auth/forgot-password", { method: "POST", body: JSON.stringify(dados) });

        notificar(
            resultado?.message || "Se o e-mail estiver cadastrado, enviaremos as instruções para redefinir a senha.",
            "sucesso",
            { duracao: 8000 }
        );
    } catch (erro) {
        if (!(erro instanceof ApiError) || erro.status === 0) {
            notificar("Não foi possível conectar ao servidor.", "erro");
            console.error("Erro na recuperação:", erro);
        } else if (erro.code === "TOO_MANY_REQUESTS") {
            notificar(erro.message, "erro", { duracao: 8000 });
        } else if (erro.code === "VALIDATION_ERROR") {
            notificar("Informe um e-mail válido.", "aviso");
        } else {
            notificar("Não foi possível solicitar a recuperação.", "erro");
        }
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
