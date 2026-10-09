# Frontend FinanceAI

SPA em HTML, CSS e JavaScript nativos, organizada por features. `src/app/main.js` inicializa as rotas hash e protege as rotas privadas conforme a sessão.

Cada feature contém `components/`, `services/` e `styles/`. A comunicação com o Backend é REST/HTTP: services chamam exclusivamente `apiFetch` de `src/core/http/api.js`, que centraliza a URL base, o token JWT, a leitura de respostas e erros HTTP. A URL base padrão é `http://localhost:3000/api`; configure `window.FINANCEAI_API_URL` antes do módulo principal para outro ambiente.

Consulte `src/core/core.md`, `src/features/featuresExemplo.md` e `src/features/auth/authExemplo.md` para os contratos arquiteturais e exemplos.
