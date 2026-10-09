# Estrutura do Frontend

- `app/`: bootstrap e roteamento da SPA.
- `core/http/`: wrapper central para chamadas REST.
- `core/session/`: armazenamento e leitura da sessão.
- `core/styles/`: estilos e tokens globais.
- `features/`: módulos de negócio independentes com components, services e styles.
- `shared/`: componentes e utilitários reutilizáveis.

Fluxo de integração: interface → service da feature → `apiFetch` → Backend REST. Services não devem usar `fetch` diretamente.
