# TransaÃ§Ãµes

Esta pasta reÃºne a fatia de frontend responsÃ¡vel por receitas e despesas manuais, origem manual ou Open Finance sandbox/Pluggy, categorizaÃ§Ã£o, filtros, ediÃ§Ã£o, exclusÃ£o e duplicaÃ§Ã£o. A organizaÃ§Ã£o segue a arquitetura por funcionalidade definida para o FinanceAI.

## OrganizaÃ§Ã£o

```text
transactions/
â”œâ”€â”€ components/  # telas, formulÃ¡rios e componentes
â”œâ”€â”€ services/    # integraÃ§Ã£o por HTTP REST com o Backend
â””â”€â”€ styles/      # CSS especÃ­fico do mÃ³dulo
```

## Modelo inicial

```js
const transacao = { id: "txn-001", descricao: "Mercado", tipo: "despesa", valor: 245.90, categoria: "AlimentaÃ§Ã£o", origem: "manual", data: "2026-10-05" };
```

## Exemplo de tela com estados

```js
import { listarDados } from "./services/transactionsService.js";

export async function renderizar(container) {
  container.innerHTML = '<section aria-busy="true"><h1>TransaÃ§Ãµes</h1><p>Carregando...</p></section>';
  try {
    const dados = await listarDados();
    const lista = document.createElement("pre");
    lista.textContent = JSON.stringify(dados, null, 2);
    container.replaceChildren(Object.assign(document.createElement("h1"), { textContent: "TransaÃ§Ãµes" }), lista);
  } catch (erro) {
    const aviso = document.createElement("p");
    aviso.setAttribute("role", "alert");
    aviso.textContent = "NÃ£o foi possÃ­vel carregar os dados. Tente novamente.";
    container.replaceChildren(aviso);
  }
}
```

Os nomes de rota, campos e respostas devem seguir o contrato real do Backend. Identifique claramente dados mockados enquanto a integraÃ§Ã£o nÃ£o estiver pronta.

## CritÃ©rios da feature

- Tratar carregamento, erro, lista vazia e sucesso.
- Usar rÃ³tulos, semÃ¢ntica HTML e navegaÃ§Ã£o por teclado.
- Formatar datas e valores com `pt-BR` e BRL.
- Atualizar a interface somente apÃ³s o Backend confirmar a operaÃ§Ã£o.

