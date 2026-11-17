export function iniciarReportarProblema() {
    const formulario = document.getElementById("form-reportar-problema");
    const mensagem = document.getElementById("mensagem-reporte");

    if (!formulario || !mensagem) return;

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
            mensagem.textContent = "Faça login para enviar um relatório.";
            return;
        }
        botao.disabled = true;
        botao.textContent = "Enviando...";
        mensagem.textContent = "";
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

            mensagem.textContent = "Problema reportado com sucesso!";
            formulario.reset();

        } catch (erro) {
            mensagem.textContent = erro.message || "Não foi possível enviar o relatório.";
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
