
import { notificar } from "../../../shared/components/notificacao.js";

// Tempo (ms) entre "senha redefinida" e a volta ao login (também a duração da linha de carregamento da notificação).
const ESPERA_REDIRECIONAMENTO_MS = 3000;

const redefinirForm = document.querySelector("#redefinir-form");
const novaSenha = document.querySelector("#nova-senha");
const confirmarSenha = document.querySelector("#confirmar-senha");
const redefinirBotao = redefinirForm.querySelector('button[type="submit"]');
let redirecionando = false;

const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("token");

redefinirForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (redirecionando || redefinirBotao.disabled) return;

    if (!token) {
        notificar("Link de recuperação inválido.", "erro");
        return;
    }

    if (novaSenha.value !== confirmarSenha.value) {
        notificar("As senhas não coincidem.", "aviso");
        return;
    }

    redefinirBotao.disabled = true;
    try {
        const resposta = await fetch("/v1/auth/reset-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: token,
                senha: novaSenha.value
            })
        });
        if (!resposta.ok) {
            notificar(
                resposta.status === 400
                    ? "Link inválido ou expirado."
                    : "Não foi possível redefinir a senha.",
                "erro"
            );
            return;
        }

        redefinirForm.reset();
        redirecionando = true;
        notificar("Senha redefinida com sucesso! Estamos levando você para o login...", "sucesso", {
            duracao: ESPERA_REDIRECIONAMENTO_MS,
            pausavel: false
        });
        setTimeout(function () {
            window.location.href = "/src/features/auth/components/inicio.html";
        }, ESPERA_REDIRECIONAMENTO_MS);
    } catch (error) {
        notificar("Não foi possível conectar ao servidor.", "erro");
        console.error("Erro ao redefinir senha:", error);
    } finally {
        if (!redirecionando) redefinirBotao.disabled = false;
    }
});
