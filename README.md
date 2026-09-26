# FinanceAI

> ⚠️ **Documento provisório.** Este README será atualizado ao longo do Sprint 0 e das sprints seguintes, conforme o sistema for tomando forma. Seções marcadas como "TODO" ainda não têm conteúdo definitivo.

Plataforma de gestão financeira pessoal que centraliza contas, cartões e investimentos em um único painel, usando Inteligência Artificial generativa para transformar dados financeiros brutos em explicações e orientações educacionais — sem depender de um consultor humano.

Projeto desenvolvido para a disciplina de Projeto Integrador 4, curso de Engenharia de Software — PUC-Campinas.

## Integrantes

- Cezar Fernandez Rull
- Gabriel Henrique Pozeti de Faria
- Julia Da Silva Maia
- Miguel Fernandes Monteiro

## Tecnologias utilizadas

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS e JavaScript (sem TypeScript, sem bundler) |
| Backend | TypeScript / Node.js |
| Servidor | Java (sistema cliente-servidor por sockets, threads) |
| Banco de dados | MongoDB |
| Controle de versão | Git + GitHub (Git Flow) |
| Gerenciamento | GitHub Projects |

## Arquitetura (resumo)

O sistema é dividido em quatro camadas independentes:

- **Frontend** — telas web que o usuário acessa.
- **Backend** — API REST consumida pelo Frontend; único cliente do Servidor Java.
- **Servidor** — processo Java separado do Backend, baseado no sistema de sockets ensinado em aula (Aceitador/Supervisora/Parceiro), responsável pelos cálculos e regras de negócio mais intensivas de cada funcionalidade.
- **Banco de dados** — MongoDB, com coleções isoladas por funcionalidade.

O projeto é dividido em 5 grupos de features, cada um responsável por uma fatia vertical completa (Frontend + Backend + Servidor + BD): Autenticação & Conta, Transações, Painel Financeiro & Análise, Mentor Financeiro (IA) e Metas & Investimentos.

Detalhes completos da arquitetura, divisão de grupos, padrão de issues e cronograma de sprints estão em [`docs/organizacao-sprints.md`](docs/organizacao-sprints.md). O escopo e os requisitos funcionais completos estão em [`docs/documento-de-visao.docx`](docs/documento-de-visao.docx).

## Como executar (TODO)

> Instruções ainda incompletas — serão fechadas ao final do Sprint 0, quando os três ambientes estiverem configurados.

### Frontend
```
# TODO — abrir index.html diretamente no navegador (sem build)
```

### Backend
```
# TODO — cd backend && npm install && npm run dev
```

### Servidor
```
# TODO — compilar e rodar via javac/java, sem Maven/Gradle
# javac -d bin src/**/*.java
# java -cp bin;lib/json.jar Main
```

### Banco de dados
```
# TODO — instância local do MongoDB, string de conexão em .env
```

## Estrutura do repositório

```
backend/     # API REST em TypeScript/Node.js
servidor/    # Servidor Java por sockets
frontend/    # Telas em HTML/CSS/JS
docs/        # Documento de visão, organização de sprints, contratos de API
```

## Fluxo de trabalho

- Branches: `main` (estável) ← `develop` (integração) ← `feature/grupoN-nome-da-feature`
- Toda tarefa vira uma issue no padrão `[Sprint N][Camada][Grupo] Título`, com Descrição, Objetivo e Métrica de sucesso
- Acompanhamento no GitHub Projects, com campos "Sprint" e "Grupo"
- Tag de entrega final: `1.0.0-final`

## Status atual

🚧 Sprint 0 — documentação, contratos entre grupos e ambientes sendo configurados.
