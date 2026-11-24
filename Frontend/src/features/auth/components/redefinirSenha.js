/*
Autor: Julia Da Silva Maia 
 RA: 25016200
 */
import { notificar } from "../../../shared/components/notificacao.js";
import { api, ApiError } from "../../../core/http/api.js";
import { traduzirValidacaoNativa } from "../../../shared/utils/validacaoEmPortugues.js";

traduzirValidacaoNativa();

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
        await api("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({
                token: token,
                senha: novaSenha.value
            })
        });

        redefinirForm.reset();
        redirecionando = true;
        notificar("Senha redefinida com sucesso! Estamos levando você para o login...", "sucesso", {
            duracao: ESPERA_REDIRECIONAMENTO_MS,
            pausavel: false
        });
        setTimeout(function () {
            window.location.href = "/src/features/auth/components/inicio.html";
        }, ESPERA_REDIRECIONAMENTO_MS);
    } catch (erro) {
        if (!(erro instanceof ApiError) || erro.status === 0) {
            notificar("Não foi possível conectar ao servidor.", "erro");
            console.error("Erro ao redefinir senha:", erro);
        } else if (erro.details?.senha?.[0]) {
            // a nova senha não segue as regras (mínimo de 8 caracteres, minúscula, maiúscula, número e caractere especial)
            notificar(erro.details.senha[0], "aviso");
        } else if (erro.code === "INVALID_RESET_TOKEN" || erro.code === "VALIDATION_ERROR") {
            notificar("Link inválido ou expirado.", "erro");
        } else {
            notificar("Não foi possível redefinir a senha.", "erro");
        }
    } finally {
        if (!redirecionando) redefinirBotao.disabled = false;
    }
});
