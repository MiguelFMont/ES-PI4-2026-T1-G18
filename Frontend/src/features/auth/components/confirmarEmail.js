
async function confirmarEmail() {
    const token = new URLSearchParams(window.location.search).get("token");
    const mensagem = document.getElementById("mensagem");

    if (!token) {
        mensagem.textContent = "Token de confirmação não encontrado.";
        return;
    }

    try {
        const resposta = await fetch("/v1/auth/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.message || dados.error?.message || "Erro ao confirmar e-mail.");
        }

        mensagem.textContent = "E-mail confirmado com sucesso! Você já pode fazer login.";
    } catch (erro) {
        mensagem.textContent = erro instanceof Error
            ? erro.message
            : "Não foi possível confirmar seu e-mail.";
    }
}

confirmarEmail();
