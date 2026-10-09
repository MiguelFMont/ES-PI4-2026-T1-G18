# FinanceAI — Organização de Sprints, Arquitetura e Grupos de Features
### ES-PI4-2026-T1-G18

Blocos independentes — dá pra ler e aplicar cada um separadamente:

1. Arquitetura de componentes
2. Divisão em 5 grupos de features (independentes entre si)
3. Padrão de issue/feature
4. Fluxo de trabalho no Git (Git Flow + GitHub Projects)
5. Estrutura de pastas (Clean Architecture por feature)
6. Cronograma de sprints

---

## 1. Arquitetura de componentes

O Servidor Java é o sistema cliente-servidor por sockets (o "fazedor de continhas" ensinado em aula), adaptado para o FinanceAI — não é uma API REST. É um processo **separado do Backend**, com sua própria arquitetura de threads. Como a serialização nativa do Java (`ObjectOutputStream`) só funciona entre programas Java, o protocolo troca mensagens em **JSON pelo socket** em vez de objetos serializados nativamente — a arquitetura de threads (Aceitador/Supervisora/Parceiro) fica igual à do exemplo original.

Quatro camadas:

- **Frontend (HTML/CSS/JavaScript):** telas web do FinanceAI.
- **Backend (TypeScript/Node.js):** API REST (Express) consumida pelo frontend, com autenticação por JWT. Faz o CRUD e acessa o MongoDB (Mongoose), valida as requisições, chama serviços externos (API de IA, Pluggy) e pede ao Servidor Java as **operações específicas** de cada feature. É o único **cliente** do Servidor Java: mantém um **pool de conexões duradouras** de socket (usando o módulo `net` do Node), cada uma atendendo um pedido por vez, como um `Cliente` do exemplo original que fica conectado e escuta o `ComunicadoDeDesligamento`; troca mensagens JSON no lugar do `ObjectOutputStream`/`ObjectInputStream`.
- **Servidor (Java):** processo à parte, rodado independentemente do Backend, replicando a arquitetura do professor. Funciona como o "fazedor de continhas": recebe os dados no pedido, executa uma operação e devolve o resultado; **não acessa banco de dados**:
  - `Comunicado` — classe-base das mensagens (no exemplo original ela só precisa ser `Serializable`; na nossa adaptação ela vira a base de um "envelope" JSON com um campo `tipo`).
  - `Parceiro` — embrulha o socket + leitura/escrita, com os métodos `envie/receba/espie` do exemplo, só que lendo/escrevendo linhas JSON em vez de objetos serializados.
  - `Aceitador` — thread que fica em loop aceitando conexões (`accept()`) — na prática só o Backend se conecta, mas mantemos a estrutura genérica do exemplo.
  - `Supervisora` — uma thread por conexão aceita; em vez do if/else de operações do exemplo (mais, menos, vezes, dividir), despacha por **tipo de mensagem** para o handler do grupo dono daquele tipo.
  - Uma lista compartilhada (`usuários`/conexões, com mutex/semáforo como no exemplo) guarda as conexões ativas — no nosso caso, as conexões do pool do Backend (cada uma com a sua `Supervisora`).
- **BD (MongoDB):** coleções isoladas por feature, para não gerar acoplamento entre grupos. Só o Backend acessa o banco (um `repository` por grupo, via Mongoose); o Servidor Java não tem banco.

Cada grupo cria seus próprios tipos de mensagem (`PedidoXxx`/`RespostaXxx`, estendendo `Comunicado`) e um handler para eles, registrado num dispatcher central — assim ninguém edita o mesmo arquivo de despacho que outro grupo, só registra sua entrada:

| Grupo | Tipos de mensagem que ele registra no Servidor Java (operações específicas; o CRUD e o banco ficam no Backend) |
|---|---|
| Autenticação & Conta | `PedidoHashSenha`, `PedidoValidarSenha`, `PedidoGerarSegredoMFA`, `PedidoValidarMFA` |
| Transações (receitas/despesas) | `PedidoCategorizarTransacao` |
| Painel Financeiro & Análise | `PedidoCalcularIndicadores`, `PedidoCompararPeriodos` |
| Mentor Financeiro (IA) | `PedidoMontarContextoIA`, `PedidoFiltrarResposta` |
| Metas & Investimentos | `PedidoProgressoMeta`, `PedidoRentabilidadeSimulada`, `PedidoCalcularParcelamentos` |

---

## 2. Divisão em 5 grupos de features

Cada grupo é uma **fatia vertical completa** (Frontend + Backend + Servidor Java + BD) e não depende de nenhuma feature pronta de outro grupo — só depende de **contratos combinados no Sprint 0** (formato dos dados, nomes de coleções, endpoints). Um grupo pode terminar antes do outro sem travar ninguém.

### Grupo 1 — Autenticação & Conta
- Cadastro (nome, e-mail, CPF, senha) e login
- Recuperação de senha
- MFA opcional
- Perfil e preferências (modo claro/escuro, ocultar valores sensíveis)
- Plano da conta (Free/Pro) e tela de upgrade
- Canal de suporte / reportar problema

### Grupo 2 — Transações (Receitas e Despesas)
- Cadastro manual de receita e despesa
- Importação de transações via sandbox de Open Finance (Pluggy) — instituições fictícias, sem credenciais reais
- Gerenciamento de contas conectadas (listar, conectar/remover pelo widget da Pluggy)
- Categorização automática, com edição manual
- Listagem e filtros (categoria, período, valor, origem)
- Editar, excluir e duplicar lançamento

### Grupo 3 — Painel Financeiro & Análise de Gastos
- Dashboard inicial (saldo, gastos do mês, economia, fluxo de caixa)
- Distribuição de gastos por categoria, com visão agregada por grupos de categoria
- Comparação entre períodos (mensal, últimos 6 meses, YTD)
- Resumo do período (total, categoria de maior peso, média diária)

### Grupo 4 — Mentor Financeiro (IA Generativa)
- Chat com IA sobre a situação financeira do usuário
- Explicações proativas sobre padrões identificados
- Alertas (gasto fora do padrão, fatura próxima, dinheiro parado)
- Restrição: nunca recomendar compra/venda de ativo específico

### Grupo 5 — Metas Financeiras & Investimentos
- Cadastro e acompanhamento de metas financeiras
- Painel de investimentos simulado (patrimônio, portfólio, fatura de cartão)
- Parcelamentos ativos do cartão (parcela atual/total, valor mensal)

> Dados que um grupo consome de outro (ex.: Grupos 3, 4 e 5 usam as transações do Grupo 2) usam **dados de seed/mock** definidos no Sprint 0, sem esperar a feature real ficar pronta.

---

## 3. Padrão de issue/feature

Toda issue no GitHub segue o formato `[Sprint 1][Frontend] Criar projeto web (HTML/CSS/JS)`:

```
Título: [Sprint N][Camada][grupo] Nome curto da tarefa

Descrição:
Uma ou duas frases sobre o que precisa ser feito.

Objetivo:
Por que essa tarefa existe / o que ela destrava.

Métrica de sucesso:
- Item verificável 1
- Item verificável 2
- Item verificável 3
```

- `Camada` = Frontend, Backend, Servidor ou BD.
- Labels em cada issue: `grupo-1` a `grupo-5`, `sprint-0` a `sprint-5`, e a camada.
- Descrição e objetivo curtos — sem parágrafo enorme de requisito.

---

## 4. Fluxo de trabalho no Git

**Git Flow:**
- `main` → sempre estável, só recebe merge de `release/*` ou `hotfix/*`
- `develop` → integração contínua das features
- `feature/grupoN-nome-da-feature` → uma branch por issue, sai de `develop` e volta pra `develop` via PR
- `release/1.0.0` → aberta perto da entrega final
- Tag final: `1.0.0-final`

**GitHub Projects:**
- Board único do repositório, colunas: `Backlog → To Do → In Progress → In Review → Done`
- Campos customizados "Sprint" (0 a 5) e "Grupo" (1 a 5) em cada card
- PR sempre vinculado à issue (`Closes #9`) e revisado por pelo menos 1 outro integrante antes do merge em `develop`

---

## 5. Estrutura de pastas (Clean Architecture por feature)

Mesmo padrão nas três camadas de código — pasta por feature, não por tipo de arquivo:

**Backend (TypeScript)** — API REST com Express (detalhes em `Backend/README.md`):
```
Backend/src/
  config/           env (variáveis de ambiente validadas com zod)
  database/         mongo.connection (conexão Mongoose com o Atlas)
  shared/errors/    app-error, error-codes (tabela code -> status HTTP)
  java-client/      Comunicado, Parceiro, JavaServerClient (pool de conexões com o Servidor Java)
  http/             app (Express e rotas), server (listen)
  modules/sistema/  /v1/health e /v1/eco (verifica Backend -> Servidor Java)
  middlewares/      auth.middleware (JWT), error-handler.middleware
  modules/
    auth/
      mfa/
        mfa.routes.ts
        mfa.controller.ts
        mfa.service.ts
      auth.routes.ts
      auth.controller.ts
      auth.service.ts
      auth.repository.ts
      auth.model.ts
      auth.dto.ts
    transactions/
    dashboard/
    mentor-ia/
    goals/
    investments/
```
Cada módulo segue o mesmo padrão `routes` / `controller` / `service` / `repository` / `model` / `dto`; o `repository` é o único arquivo do módulo que fala com o MongoDB.

**Mensagens entre Backend e Servidor** — os nomes (`PedidoXxx`/`RespostaXxx`), os campos e os `code` de erro são combinados entre os grupos no Sprint 0. O Servidor responde erros só com `code` e `message`; o Backend traduz o `code` em status HTTP (`shared/errors/error-codes.ts`). O Servidor escuta apenas em `127.0.0.1`, atende várias conexões simultâneas (uma `Supervisora` por conexão) e fecha conexões que ficam 5 minutos sem enviar nada (o Backend reconecta sozinho).

**Servidor (Java)** — arquitetura do professor (sockets), organizada por feature dentro dela:
```
Servidor/src/main/java/com/financeai/
  core/
    Comunicado.java          // classe-base das mensagens (envelope JSON)
    Parceiro.java            // socket + envie/receba/espie (adaptado pra JSON)
    Aceitadora.java          // thread que aceita conexões
    Supervisora.java         // thread por conexão, despacha por tipo de mensagem
    HandlerRegistry.java     // registro tipo-de-mensagem -> handler (cada grupo se registra aqui)
    Handler.java             // contrato de um tratador de pedido
    ErroDeNegocio.java       // falha de regra -> resposta Erro (code, message; o status HTTP é do Backend)
    EcoHandler.java          // handler de teste (PedidoEco -> RespostaEco)
  auth/
    AuthHandler.java
    PedidoHashSenha, PedidoValidarSenha, PedidoGerarSegredoMFA, PedidoValidarMFA (+ Respostas)
  transactions/
    TransactionsHandler.java
    PedidoCategorizarTransacao (+ Resposta)
  dashboard/
    DashboardHandler.java
    PedidoCalcularIndicadores, PedidoCompararPeriodos (+ Respostas)
  mentoria/
    MentorHandler.java
    PedidoMontarContextoIA, PedidoFiltrarResposta (+ Respostas)
  goals/
    GoalsHandler.java
    PedidoProgressoMeta (+ Resposta)
  investments/
    InvestmentsHandler.java
    PedidoRentabilidadeSimulada, PedidoCalcularParcelamentos (+ Respostas)
  Main.java                  // parse de args, sobe a estrutura compartilhada, starta o Aceitador
```
Cada grupo só mexe na sua própria pasta (suas mensagens e seu handler) e adiciona uma linha no `HandlerRegistry` — evita todo mundo editando o mesmo arquivo de despacho.

**Frontend (HTML/CSS/JavaScript)**
```
frontend/src/features/
  auth/
    components/
    services/
    styles/
  transactions/
  dashboard/
  mentor-ia/
  goals/
  investments/
```

Cada feature carrega seu próprio `components/services/styles` (ou `controller/service/repository`), sem uma pasta genérica de "utils" crescendo sem dono — só o essencial (cliente HTTP, tema/CSS base) fica num módulo `core/` ou `shared/` comum.

---

## 6. Cronograma de sprints (50 dias)

Cada grupo segue a mesma sequência (CRUD básico → regra de negócio própria → resto das telas → integração real → estabilização), só muda o que cada um entrega em cada etapa.

### Sprint 0 — 5 dias — Documentação e contratos (todos os grupos juntos)
- Documento de visão e requisitos finalizados
- Contratos de API entre grupos (formato de dados, nomes de coleções, endpoints)
- Dados de seed/mock de todas as coleções
- Estrutura de pastas, board do GitHub Projects e Git Flow configurados
- Ambientes (Backend, Servidor Java, Frontend, BD) rodando localmente para todos
- Base do Backend: Express, conexão com o MongoDB Atlas, `java-client` (pool de conexões duradouras), `error-handler` e tabela `code -> status`; `/v1/health` e `/v1/eco` provam o caminho Frontend -> Backend -> Servidor Java e de volta
- Nomes e campos das mensagens (`PedidoXxx`/`RespostaXxx`) e `code` de erro acordados entre os grupos; o Servidor só executa operações (sem banco), o CRUD e o MongoDB ficam no Backend
- Base do Servidor Java adaptada do exemplo do professor: `Comunicado`, `Parceiro` (com JSON no lugar da serialização nativa), `Aceitador`, `Supervisora`, `HandlerRegistry` funcionando com um handler de teste — essa parte é comum a todos os grupos, então vale ser feita em conjunto ou por uma pessoa só antes dos grupos começarem a registrar seus próprios tipos de mensagem
- Conta e API key do sandbox da Pluggy criadas (Grupo 2 é responsável, mas a chave fica disponível para o time todo)

### Sprint 1 — 10 dias — Fluxo principal (com dados mockados dos outros grupos)
| Grupo | Entrega |
|---|---|
| 1 — Autenticação & Conta | Cadastro e login |
| 2 — Transações | Cadastro manual de receita/despesa + listagem simples |
| 3 — Painel & Análise | Dashboard inicial básico (saldo, gastos do mês) |
| 4 — Mentor Financeiro (IA) | Tela de chat + endpoint de chat com resposta mockada |
| 5 — Metas & Investimentos | Cadastro de metas (CRUD básico) |

### Sprint 2 — 10 dias — Regra de negócio própria de cada grupo (mensagem + handler no Servidor Java)
| Grupo | Entrega |
|---|---|
| 1 — Autenticação & Conta | Recuperação de senha + `PedidoHashSenha`/`PedidoValidarSenha`/`PedidoGerarSegredoMFA`/`PedidoValidarMFA` e handler registrados no Servidor Java |
| 2 — Transações | Categorização automática (`PedidoCategorizarTransacao` + handler no Servidor Java) + edição manual de categoria |
| 3 — Painel & Análise | Fluxo de caixa e economia (`PedidoCalcularIndicadores` + handler no Servidor Java) |
| 4 — Mentor Financeiro (IA) | Integração real com a API de IA generativa + `PedidoMontarContextoIA` no Servidor Java |
| 5 — Metas & Investimentos | `PedidoProgressoMeta` + handler no Servidor Java + acompanhamento visual |

### Sprint 3 — 10 dias — Telas e regras restantes
| Grupo | Entrega |
|---|---|
| 1 — Autenticação & Conta | MFA opcional + tela de perfil e preferências (modo claro/escuro, ocultar valores) + plano da conta (Free/Pro) e canal de suporte |
| 2 — Transações | Integração com sandbox de Open Finance da Pluggy (conectar conta + importar transações) + gerenciamento de contas conectadas + filtros avançados (período, valor, origem) + duplicar lançamento |
| 3 — Painel & Análise | Gráfico de gastos por categoria (com visão por grupos) + comparação entre períodos |
| 4 — Mentor Financeiro (IA) | Explicações proativas sobre padrões + filtro de segurança (nunca recomendar ativo) |
| 5 — Metas & Investimentos | Painel de investimentos simulado (patrimônio, portfólio) + parcelamentos ativos do cartão |

### Sprint 4 — 10 dias — Integração real entre grupos + testes
| Grupo | Entrega |
|---|---|
| 1 — Autenticação & Conta | Autenticação passa a valer para todos os fluxos do sistema (sem mocks) + testes |
| 2 — Transações | Transações reais consumidas por Painel, Mentor e Metas (sem mocks) + testes |
| 3 — Painel & Análise | Resumo do período com dados reais de transações + testes |
| 4 — Mentor Financeiro (IA) | Alertas (gasto fora do padrão, fatura próxima, dinheiro parado) com dados reais + testes |
| 5 — Metas & Investimentos | Fatura de cartão simulada + metas usando transações reais + testes |

### Sprint 5 — 5 dias — Estabilização (todos os grupos)
- Correção de bugs encontrados na integração
- Sem features novas
- Ensaio da apresentação
- Tag `1.0.0-final`

| **Total** | **50 dias** |
