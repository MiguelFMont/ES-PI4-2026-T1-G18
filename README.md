# FinanceAI

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
- **Backend** — API REST (Node.js, TypeScript e Express) consumida pelo Frontend, com autenticação por JWT. Faz o CRUD e acessa o MongoDB, valida as requisições, chama serviços externos (API de IA, Pluggy) e pede ao Servidor Java as operações específicas de cada feature. Mantém um pool de conexões duradouras de socket com o Servidor (como um `Cliente` do exemplo ensinado em aula, que fica conectado) e traduz os erros do Servidor (`code`) em status HTTP.
- **Servidor** — processo Java separado do Backend, baseado no sistema de sockets ensinado em aula (Aceitadora/Supervisora/Parceiro, uma `Supervisora` por conexão), com mensagens em JSON. Funciona como o "fazedor de continhas": recebe os dados no pedido, executa uma operação (hash de senha, categorização, indicadores, filtro da IA...) e devolve o resultado. Não acessa banco de dados, aceita conexões só da própria máquina (`127.0.0.1`) e não conhece HTTP: os erros saem como `code` + `message`.
- **Banco de dados** — MongoDB (Atlas), com coleções isoladas por funcionalidade; acessado só pelo Backend.

O projeto é dividido em 5 grupos de features, cada um responsável por uma fatia vertical completa (Frontend + Backend + Servidor + BD): Autenticação & Conta, Transações, Painel Financeiro & Análise, Mentor Financeiro (IA) e Metas & Investimentos.

Detalhes completos da arquitetura, divisão de grupos, padrão de issues e cronograma de sprints estão em [`docs/organizacao-sprints.md`](docs/organizacao-sprints.md). O escopo e os requisitos funcionais completos estão em [`docs/documento-de-visao.md`](docs/documento-de-visao.md), o dicionário de dados em [`docs/dicionario-de-dados.md`](docs/dicionario-de-dados.md), o contrato de todas as rotas em [`docs/contrato-api.md`](docs/contrato-api.md) e o roteiro do teste completo em [`docs/checklist-teste-completo.md`](docs/checklist-teste-completo.md).

### O que cada grupo entregou

| Grupo | Frontend | Backend (`/v1/...`) | Servidor Java |
|---|---|---|---|
| 1 — Autenticação & Conta | login, cadastro, recuperação de senha, perfil e preferências, planos, suporte | `auth`, `suporte` | hash e conferência de senha (PBKDF2) |
| 2 — Transações | extrato com filtros, edição e exclusão em lote (com "Desfazer"), duplicar, categoria automática, contas manuais e Open Finance (Pluggy, plano Pro), transferências entre contas, compra no crédito com cartão e parcelas | `transactions`, `accounts`, `connected-accounts`, `undo` | categorização pela descrição e saldo das contas |
| 3 — Painel & Análise | dashboard, gastos por categoria, comparação de períodos | `dashboard` | indicadores e comparação de períodos |
| 4 — Mentor Financeiro (IA) | chat, alertas e mensagens proativas (Insight) | `mentor-ia` | contexto da IA e filtro de resposta |
| 5 — Metas & Investimentos | metas (prazo opcional, com ícone e cor), cartões de crédito (até 5, cada um vinculado a uma conta) com a fatura e os lançamentos de cada um (mesmas peças das Transações) | `goals`, `investments` | progresso de meta, parcelamentos e rentabilidade simulada |

Ainda não há tela para o portfólio de investimentos (só a API). Outras ideias futuras: categorias digitáveis, aplicativo móvel.

### Contas, transferências e cartões

- **Contas:** toda pessoa tem ao menos uma conta. Uma conta é **manual** (saldo calculado pelo Servidor Java a partir do saldo inicial e dos lançamentos) ou **Open Finance** (vinda da Pluggy, só no plano Pro, somente leitura: só o ícone e a cor mudam, não se exclui e não aceita lançamento manual; ao desconectar, ela e os cartões dela viram manuais).
- **Transferências:** movem valor entre duas contas manuais (um único registro, que não é receita nem despesa).
- **Cartões:** cada cartão pertence a uma conta manual (ou vem do Open Finance); a fatura fecha no dia escolhido e vence 7 dias depois. Na aba Cartão há a fatura do mês e a lista de lançamentos do cartão, com filtros, edição e criação de despesa e receita (a receita no cartão é um estorno e abate a fatura).
- **Aparência:** contas, cartões e metas aceitam ícone e cor; sem eles vale o logo do banco (`Frontend/assets/bancos/`).
- **Exclusão e desfazer:** excluir um cartão exclui também os lançamentos e parcelamentos dele; excluir uma conta exclui os cartões e lançamentos dela. A notificação traz "Desfazer" (`POST /v1/undo/:id`, vale 30 segundos, só na memória do Backend).
- Detalhes no contrato da API ([`docs/contrato-api.md`](docs/contrato-api.md)) e nos diagramas de [`docs/uml/`](docs/uml/README.md).

## Como executar

Suba nesta ordem: Servidor Java (porta 3000), depois o Backend (porta 3001, que também entrega o Frontend). Abra `http://localhost:3001`.

### Frontend
```
# Sem build: o Backend serve o Frontend em http://localhost:3001
# Detalhes em Frontend/README.md
```

### Backend
```
# Requer Node 20+ (usado: 22). Copie Backend/.env.example para Backend/.env e ajuste JWT_SECRET, MFA_JWT_SECRET (mínimo de 32 caracteres) e MONGO_URI.
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
# no Atlas e coloca a string de conexão em MONGO_URI no Backend/.env (nunca commitar).
# Passo a passo em Backend/README.md (seção "MongoDB Atlas")
```

### Testes automatizados
```
cd Backend && npm test      # node:test (718 testes); MongoDB em memória, IA e Servidor Java simulados (sem .env)
cd Servidor && mvn test     # JUnit 5 (188 testes), inclusive os testes OO intraclasse e interclasse do Grupo 2
# Integração Backend -> Servidor Java (com o Servidor no ar): JAVA_SERVER_INTEGRACAO=1 npm test
# Detalhes na seção "Testes" de Backend/README.md e Servidor/README.md (ainda não há CI)
```

## Estrutura do repositório

```
Backend/     # API REST em TypeScript/Node.js (Express), MongoDB e cliente do Servidor Java
Servidor/    # Servidor Java por sockets (JSON) que executa as operações específicas, build com Maven
Frontend/    # Telas em HTML/CSS/JS
docs/        # Documento de visão, organização de sprints, contrato da API, checklist de teste e palavras-chave das categorias
```

## Fluxo de trabalho

- Branches: `main` (estável) ← `develop` (integração) ← `feature/grupoN-nome-da-feature`
- Toda tarefa vira uma issue no padrão `[Sprint N][Camada][Grupo] Título`, com Descrição, Objetivo e Métrica de sucesso
- Acompanhamento no GitHub Projects, com campos "Sprint" e "Grupo"
- Tag de entrega final: `1.0.0-final`

## Status atual

Versão de entrega (1.0.0-final em preparação): as quatro camadas e os cinco grupos estão implementados e integrados na branch `develop`. Backend com 718 testes e Servidor com 188, todos passando. Falta o teste completo manual (`docs/checklist-teste-completo.md`), o ensaio da apresentação e a tag `1.0.0-final`.
