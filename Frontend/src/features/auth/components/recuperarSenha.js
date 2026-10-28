const recuperarForm = document.querySelector("#recuperar-form");
const recuperarEmail = document.querySelector("#recuperar-email");
const recuperarErro = document.querySelector("#recuperar-erro");

recuperarForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    recuperarErro.textContent = "";

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
            recuperarErro.textContent = "Não foi possível solicitar a recuperação.";
            return;
        }

        recuperarErro.textContent = resultado.message;
    } catch (error) {
        recuperarErro.textContent = "Não foi possível conectar ao servidor.";
        console.error("Erro na recuperação:", error);
    }
});