# Módulos do Frontend

Cada feature entrega sua parte do FinanceAI em uma pasta própria, com `components/`, `services/` e `styles/`.

| Pasta | Responsabilidade |
|---|---|
| `auth/` | Cadastro, login, recuperação, MFA opcional, perfil e preferências |
| `transactions/` | Receitas, despesas, filtros e Open Finance sandbox |
| `dashboard/` | Indicadores, fluxo de caixa e análise de gastos |
| `mentor-ai/` | Chat contextual, explicações e alertas responsáveis |
| `goals/` | Metas e progresso financeiro |
| `investments/` | Carteira simulada, cartão e parcelamentos |

```text
Navegador (HTML/CSS/JS) → service da feature → WebSocket Backend → socket JSON → servidor Java
```

O browser conversa com o Backend por mensagens JSON WebSocket `{ tipo, dados }`. Combine tipos de mensagem, payloads, respostas e mocks entre as camadas antes de integrar.
