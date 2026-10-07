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
- **Backend** — API REST (Node.js, TypeScript e Express) consumida pelo Frontend, com autenticação por JWT. É um gateway: valida as requisições e repassa cada operação ao Servidor Java (uma conexão de socket por chamada, como um `Cliente` do exemplo ensinado em aula). Não acessa o banco. Traduz os erros do Servidor (`code`) em status HTTP.
- **Servidor** — processo Java separado do Backend, baseado no sistema de sockets ensinado em aula (Aceitadora/Supervisora/Parceiro, uma `Supervisora` por conexão), com mensagens em JSON. É o dono dos dados e das regras de negócio: lê e grava no MongoDB e responde ao Backend. Aceita conexões só da própria máquina (`127.0.0.1`) e não conhece HTTP: os erros saem como `code` + `message`.
- **Banco de dados** — MongoDB (Atlas), com coleções isoladas por funcionalidade; acessado só pelo Servidor Java.

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
# Requer Node 20+. Copie Backend/.env.example para Backend/.env e ajuste JWT_SECRET.
cd Backend
npm install
npm run dev          # http://localhost:3001/v1
# Detalhes (API, JWT, .env) em Backend/README.md
```

### Testar as camadas juntas
```
# 1) Servidor (porta 3000)   2) Backend (porta 3001)   3) chamar o Backend:
curl localhost:3001/v1/health                       # Backend de pé
curl -X POST localhost:3001/v1/eco -H "content-type: application/json" -d '{"oi":1}'
# -> {"oi":1}: Backend -> socket -> Servidor Java -> de volta
```

### Servidor
```
# Requer JDK 17+ e Maven (o Gson é baixado pelo Maven, via pom.xml)
cd Servidor
mvn compile
mvn exec:java -Dexec.mainClass=com.financeai.Main
# Detalhes em Servidor/README.md
```

### Banco de dados
```
# MongoDB Atlas (cluster do projeto, compartilhado). Cada integrante libera o próprio IP
# no Atlas e define a string de conexão na variável de ambiente MONGO_URI do Servidor (nunca commitar).
# Passo a passo em Servidor/README.md (seção "Banco de dados")
```

## Estrutura do repositório

```
Backend/     # API REST em TypeScript/Node.js (Express) e cliente do Servidor Java
Servidor/    # Servidor Java por sockets (JSON) e dono do MongoDB, build com Maven
Frontend/    # Telas em HTML/CSS/JS
docs/        # Documento de visão, organização de sprints, contratos de API
```

## Fluxo de trabalho

- Branches: `main` (estável) ← `develop` (integração) ← `feature/grupoN-nome-da-feature`
- Toda tarefa vira uma issue no padrão `[Sprint N][Camada][Grupo] Título`, com Descrição, Objetivo e Métrica de sucesso
- Acompanhamento no GitHub Projects, com campos "Sprint" e "Grupo"
- Tag de entrega final: `1.0.0-final`

## Status atual

🚧 Sprint 0 — base das camadas pronta: `core` do Servidor (sockets, JSON, erros, timeout) e Backend mínimo (Express, `java-client`, `/v1/eco`) funcionando juntos; o `Banco` (MongoDB) e os handlers dos grupos ainda são `.md` de exemplo. O Frontend está na branch `chore/estrutura-inicial-frontend`.
