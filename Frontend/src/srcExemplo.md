# Código-fonte do Frontend

Aplicação FinanceAI em HTML, CSS e JavaScript modular. A arquitetura por funcionalidade fica em `features/`; código realmente compartilhado pode ser colocado em `core/` ou `shared/`.

```text
src/
├── features/       # auth, transactions, dashboard, mentor-ai, goals, investments
├── core/           # cliente WebSocket, sessão e navegação compartilhados
├── styles/         # reset e tokens globais
└── main.js         # inicialização
```

```html
<main id="app" tabindex="-1"></main>
<script type="module" src="./main.js"></script>
```

```js
import { iniciarAplicacao } from "./core/app.js";
const app = document.querySelector("#app");
if (!app) throw new Error("Elemento #app não encontrado.");
iniciarAplicacao(app);
```

O navegador abre uma conexão WebSocket com o Backend. O Backend conversa com o servidor Java por socket TCP com mensagens JSON; o frontend não abre conexão direta com o servidor Java.
