# Frontend do FinanceAI

Documentação de apoio para estruturar a interface do projeto. O plano do repositório define o frontend em HTML, CSS e JavaScript, organizado por feature. Os exemplos de cada pasta estão em arquivos `*Exemplo.md`.

## Estrutura

```text
src/
├── features/
│   ├── auth/
│   ├── transactions/
│   ├── dashboard/
│   ├── mentor-ai/
│   ├── goals/
│   └── investments/
└── srcExemplo.md
```

Dentro de cada feature, `components/` contém interface, `services/` integra por WebSocket com o Backend, e `styles/` guarda o CSS específico.

## Integração entre camadas

```text
Navegador (HTML/CSS/JavaScript) → WebSocket (Backend TypeScript) → socket JSON (Servidor Java)
```

O navegador abre WebSocket com o Backend. O Backend é cliente TCP do servidor Java; a interface não se conecta diretamente ao Java. Confira os tipos de mensagem e contratos reais na branch `develop`; payloads ilustrativos precisam ser ajustados aos DTOs.

## Orientações

- Use dados mockados identificados enquanto contratos/tipos de mensagem ainda não estiverem prontos.
- Trate carregamento, erro, sucesso e listas vazias nas telas.
- Formate valores em reais e datas no padrão `pt-BR`.
- Mantenha formulários acessíveis e layouts responsivos.
- A mentoria deve explicar padrões e alertas sem recomendar compra ou venda de ativos específicos.
