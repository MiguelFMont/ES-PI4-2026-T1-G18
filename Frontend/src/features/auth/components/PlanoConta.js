
const btnFree = document.querySelector("#btn-free");
const btnPro = document.querySelector("#btn-pro");
const btnUpgrade = document.querySelector("#btn-upgrade");

const planoTipo = document.querySelector("#plano-tipo");
const planoStatus = document.querySelector("#plano-status");
const cardTitle = document.querySelector("#card-title");
const cardDescription = document.querySelector("#card-description");
const valor = document.querySelector("#valor");
const periodo = document.querySelector("#periodo");
const listaBeneficios = document.querySelector("#lista-beneficios");
const planoErro = document.querySelector("#plano-erro");

const token = localStorage.getItem("@FinanceAI:token");
let planoAtual = null;
let planoSelecionado = "free";

function mostrarPlano(plano) {
    planoSelecionado = plano;
    btnFree.classList.toggle("ativo", plano === "free");
    btnPro.classList.toggle("ativo", plano === "pro");

    // Atualiza o conteúdo do plano selecionado
    planoTipo.textContent = `Plano ${plano === "free" ? "Free" : "Pro"}`;
    cardTitle.textContent = plano === "free" ? "Free" : "Pro";
    cardDescription.textContent = plano === "free"
        ? "Organize suas finanças de forma simples"
        : "Tenha acesso a mais recursos para organizar suas finanças";
        //valor e periodo
    valor.textContent = plano === "free" ? "R$ 0" : "R$19,99";
    periodo.textContent = "/ mês";

    const beneficios = plano === "free"
        ? [
            //plano free
            "Controle de receitas e despesas",
            "Visualização das transações",
            "Organização financeira básica"
        ]
        : [
            //plano pro (definir ainda)
            "***",
            "**",
            "**",
            "**"
        ];

    listaBeneficios.replaceChildren();
    // Adiciona os benefícios à lista
    beneficios.forEach(function (beneficio) {
        const item = document.createElement("li");
        item.textContent = beneficio;
        listaBeneficios.appendChild(item);
    });

    const planoSelecionadoAtual = plano === planoAtual;
    // Atualiza o status do plano e o botão de upgrade
    planoStatus.textContent = planoSelecionadoAtual ? "Plano atual" : "Disponível";
    btnUpgrade.textContent = planoSelecionadoAtual 
    ? "Plano atual" 
    : plano === "pro"
        ?"Obter plano Pro"
        : "Obter plano Free";
    btnUpgrade.disabled = planoSelecionadoAtual;
}

btnFree.addEventListener("click", function () {
    mostrarPlano("free");
});

btnPro.addEventListener("click", function () {
    mostrarPlano("pro");
});

async function carregarPlano() {
    if (!token) {
        planoErro.textContent = "Não foi possível identificar o usuário.";
        btnUpgrade.disabled = true;
        return;
    }

    try {
        // Faz a requisição para obter os dados do usuário
        const resposta = await fetch("/v1/auth/me", {
            headers: {
                //adiciona o token no cabeçalho da requisição
                Authorization: `Bearer ${token}`
            }
        });

        const usuario = await resposta.json();
        if (!resposta.ok) {
            planoErro.textContent = "Não foi possível carregar seu plano.";
            btnUpgrade.disabled = true;
            return;
        }
        planoAtual = usuario.plano;
        mostrarPlano(planoAtual);
    } catch (error) {
        //se ocorrer algum erro na requisição, exibe a mensagem de erro e desabilita o botão de upgrade
        planoErro.textContent = "Não foi possível conectar ao servidor.";
        btnUpgrade.disabled = true;
        console.error("Erro ao carregar plano:", error);
    }
}
// Adiciona o evento de clique ao botão de upgrade
btnUpgrade.addEventListener("click", async function () {
    if (planoSelecionado === planoAtual || btnUpgrade.disabled) {
        return;
    }
    planoErro.textContent = "";
    btnUpgrade.disabled = true;
    try {
        const resposta = await fetch("/v1/auth/me/plano", {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ plano: planoSelecionado })
        });

        const usuario = await resposta.json();
        console.log("Plano solicitado:", planoSelecionado);
        console.log("Status da resposta:", resposta.status);
        console.log("Resposta do backend:", usuario);
        if (!resposta.ok) {
            //se a requisição falhar, exibe a mensagem de erro e habilita o botão de upgrade novamente
            planoErro.textContent = "Não foi possível atualizar o plano.";
            btnUpgrade.disabled = false;
            return;
        }
        planoAtual = usuario.plano;
        mostrarPlano(planoAtual);
    } catch (error) {
        //se ocorrer algum erro na requisição, exibe a mensagem de erro e habilita o botão de upgrade novamente
        planoErro.textContent = "Não foi possível conectar ao servidor.";
        btnUpgrade.disabled = false;
        console.error("Erro ao atualizar plano:", error);
    }
});

carregarPlano();
