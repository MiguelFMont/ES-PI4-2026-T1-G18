import { notificar } from "../../../shared/components/notificacao.js";
import { api, ApiError } from "../../../core/http/api.js";
import { hasToken } from "../../../core/session/storage.js";
import { irParaLogin } from "../../../core/session/login.js";

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
            "Conecte 1 banco",
            "1 agente inteligente",
            "Lembretes personalizados",
        ]
        : [
            //plano pro (definir ainda)
            "Bancos ilimitados",
            "Mensagens Ilimitadas",
            "Até 5 agentes inteligentes",
            "Relatórios personalizados"
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

// Sem resposta do Backend (rede, servidor fora do ar): o api.js devolve ApiError com status 0.
const semConexao = (erro) => !(erro instanceof ApiError) || erro.status === 0;

async function carregarPlano() {
    // Sem sessão não há plano para mostrar: vai para o login (com sessão vencida, o api.js faz o mesmo).
    if (!hasToken()) {
        irParaLogin({ substituir: true });
        return;
    }

    try {
        const usuario = await api("/auth/me");
        planoAtual = usuario.plano;
        mostrarPlano(planoAtual);
    } catch (erro) {
        //se ocorrer algum erro na requisição, exibe a mensagem de erro e desabilita o botão de upgrade
        notificar(
            semConexao(erro) ? "Não foi possível conectar ao servidor." : "Não foi possível carregar seu plano.",
            "erro"
        );
        btnUpgrade.disabled = true;
        if (semConexao(erro)) console.error("Erro ao carregar plano:", erro);
    }
}
// Adiciona o evento de clique ao botão de upgrade
btnUpgrade.addEventListener("click", async function () {
    if (planoSelecionado === planoAtual || btnUpgrade.disabled) {
        return;
    }
    btnUpgrade.disabled = true;
    try {
        const usuario = await api("/auth/me/plano", {
            method: "PATCH",
            body: JSON.stringify({ plano: planoSelecionado })
        });
        planoAtual = usuario.plano;
        mostrarPlano(planoAtual);
        notificar(`Plano alterado para ${planoAtual === "pro" ? "Pro" : "Free"}.`, "sucesso");
    } catch (erro) {
        //se a requisição falhar, exibe a mensagem de erro e habilita o botão de upgrade novamente
        notificar(
            semConexao(erro) ? "Não foi possível conectar ao servidor." : "Não foi possível atualizar o plano.",
            "erro"
        );
        btnUpgrade.disabled = false;
        if (semConexao(erro)) console.error("Erro ao atualizar plano:", erro);
    }
});

carregarPlano();
