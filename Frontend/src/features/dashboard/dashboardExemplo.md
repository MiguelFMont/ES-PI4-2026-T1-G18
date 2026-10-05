# Painel financeiro e análise

Esta pasta reúne a fatia de frontend responsável por saldo, gastos do mês, economia, fluxo de caixa, gastos por categoria e comparação mensal, semestral ou YTD. A organização segue a arquitetura por funcionalidade definida para o FinanceAI.

## Organização

```text
dashboard/
├── components/  # telas, formulários e componentes
├── services/    # integração por WebSocket com o Backend
└── styles/      # CSS específico do módulo
```

## Modelo inicial

```js
const resumo = { saldo: 4250.75, gastosMes: 1830.20, economia: 620.00, periodo: "2026-10" };
```

## Exemplo de tela com estados

```js
import { listarDados } from "./services/dashboardService.js";

export async function renderizar(container) {
  container.innerHTML = '<section aria-busy="true"><h1>Painel financeiro e análise</h1><p>Carregando...</p></section>';
  try {
    const dados = await listarDados();
    const lista = document.createElement("pre");
    lista.textContent = JSON.stringify(dados, null, 2);
    container.replaceChildren(Object.assign(document.createElement("h1"), { textContent: "Painel financeiro e análise" }), lista);
  } catch (erro) {
    const aviso = document.createElement("p");
    aviso.setAttribute("role", "alert");
    aviso.textContent = "Não foi possível carregar os dados. Tente novamente.";
    container.replaceChildren(aviso);
  }
}
```

Os nomes de rota, campos e respostas devem seguir o contrato real do Backend. Identifique claramente dados mockados enquanto a integração não estiver pronta.

## Critérios da feature

- Tratar carregamento, erro, lista vazia e sucesso.
- Usar rótulos, semântica HTML e navegação por teclado.
- Formatar datas e valores com `pt-BR` e BRL.
- Atualizar a interface somente após o Backend confirmar a operação.
