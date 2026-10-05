# Mentor financeiro

Esta pasta reúne a fatia de frontend responsável por chat contextual, explicações de padrões e alertas de gastos fora do padrão, fatura próxima e dinheiro parado. Não recomendar compra ou venda de ativo específico. A organização segue a arquitetura por funcionalidade definida para o FinanceAI.

## Organização

```text
mentor-ai/
├── components/  # telas, formulários e componentes
├── services/    # integração por WebSocket com o Backend
└── styles/      # CSS específico do módulo
```

## Modelo inicial

```js
const mensagem = { id: "msg-001", papel: "assistant", texto: "Seus gastos com alimentação cresceram neste período.", criadaEm: new Date().toISOString() };
```

## Exemplo de tela com estados

```js
import { listarDados } from "./services/mentor-aiService.js";

export async function renderizar(container) {
  container.innerHTML = '<section aria-busy="true"><h1>Mentor financeiro</h1><p>Carregando...</p></section>';
  try {
    const dados = await listarDados();
    const lista = document.createElement("pre");
    lista.textContent = JSON.stringify(dados, null, 2);
    container.replaceChildren(Object.assign(document.createElement("h1"), { textContent: "Mentor financeiro" }), lista);
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
