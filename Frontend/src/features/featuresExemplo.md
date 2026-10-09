# Módulos do Frontend

Cada feature encapsula sua interface, integração e estilos nas pastas `components/`, `services/` e `styles/`.

| Pasta | Responsabilidade |
|---|---|
| `auth/` | Cadastro, login, recuperação, perfil e preferências |
| `transactions/` | Receitas, despesas e filtros |
| `dashboard/` | Indicadores, fluxo de caixa e análise de gastos |
| `mentor-ia/` | Assistente e orientações financeiras |
| `goals/` | Metas e progresso financeiro |
| `investments/` | Carteira e simulações de investimentos |

A comunicação segue `components → services da feature → core/http/apiFetch → Backend REST`. Os services devem importar `apiFetch` de `../../core/http/api.js` e concentrar nele todas as requisições HTTP. Não use `fetch` diretamente nem crie clientes de rede por feature. Os componentes cuidam da apresentação e chamam funções do service.
