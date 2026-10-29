
const redefinirForm = document.querySelector("#redefinir-form");
const novaSenha = document.querySelector("#nova-senha");
const confirmarSenha = document.querySelector("#confirmar-senha");
const redefinirErro = document.querySelector("#redefinir-erro");

const parametros = new URLSearchParams(window.location.search);
const token = parametros.get("token");

redefinirForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    redefinirErro.textContent = "";

    if (!token) {
        redefinirErro.textContent = "Link de recuperação inválido.";
        return;
    }

    if (novaSenha.value !== confirmarSenha.value) {
        redefinirErro.textContent = "As senhas não coincidem.";
        return;
    }

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
            redefinirErro.textContent =
                resposta.status === 400
                    ? "Link inválido ou expirado."
                    : "Não foi possível redefinir a senha.";
            return;
        }

        redefinirForm.reset();
        redefinirErro.textContent = "Senha redefinida com sucesso! Volte ao login.";
    } catch (error) {
        redefinirErro.textContent = "Não foi possível conectar ao servidor.";
        console.error("Erro ao redefinir senha:", error);
    }
});
