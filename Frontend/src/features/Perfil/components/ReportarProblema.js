import { notificar } from "../../../shared/components/notificacao.js";

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
        const token = localStorage.getItem("@FinanceAI:token");
        const botao = formulario.querySelector('button[type="submit"]');

        if (!token) {
            notificar("Faça login para enviar um relatório.", "aviso");
            return;
        }
        botao.disabled = true;
        botao.textContent = "Enviando...";
        try {
            const resposta = await fetch("/v1/suporte", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    assunto,
                    categoria,
                    descricao
                })
            });

            const dados = await resposta.json();
            if (!resposta.ok) {
                throw new Error(
                    dados.message || dados.mensagem || "Erro ao enviar relatório."
                );
            }

            notificar("Problema reportado com sucesso!", "sucesso");
            formulario.reset();

        } catch (erro) {
            notificar(erro.message || "Não foi possível enviar o relatório.", "erro");
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
