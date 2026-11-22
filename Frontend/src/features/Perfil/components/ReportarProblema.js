import { notificar } from "../../../shared/components/notificacao.js";
import { api, ApiError } from "../../../core/http/api.js";

// Mensagem de erro do envio: a regra do campo que falhou (ex.: descrição com menos de 10 caracteres) ou a do Backend.
function mensagemDoErro(erro) {
    if (!(erro instanceof ApiError) || erro.status === 0) return "Não foi possível conectar ao servidor.";
    const detalhes = erro.details || {};
    return detalhes.assunto?.[0] || detalhes.categoria?.[0] || detalhes.descricao?.[0]
        || (erro.code === "VALIDATION_ERROR" ? "Confira os campos do relatório." : erro.message)
        || "Não foi possível enviar o relatório.";
}

export function iniciarReportarProblema() {
    const formulario = document.getElementById("form-reportar-problema");

    if (!formulario) return;

    // Evita registrar o evento duas vezes
    if (formulario.dataset.inicializado === "true") return;
    formulario.dataset.inicializado = "true";
    formulario.addEventListener("submit", async (event) => {
        event.preventDefault();

        const assunto = document.getElementById("assunto").value.trim();
        const categoria = document.getElementById("categoria").value;
        const descricao = document.getElementById("descricao").value.trim();
        const botao = formulario.querySelector('button[type="submit"]');

        botao.disabled = true;
        botao.textContent = "Enviando...";
        try {
            // sem sessão (ou com ela vencida) o api.js leva para o login
            await api("/suporte", {
                method: "POST",
                body: JSON.stringify({
                    assunto,
                    categoria,
                    descricao
                })
            });

            notificar("Problema reportado com sucesso!", "sucesso");
            formulario.reset();

        } catch (erro) {
            notificar(mensagemDoErro(erro), "erro");
        } finally {
            botao.disabled = false;
            botao.textContent = "Enviar relatório";
        }
    });
}

// Permite inicializar quando o arquivo é carregado diretamente
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarReportarProblema);
} else {
    iniciarReportarProblema();
}
