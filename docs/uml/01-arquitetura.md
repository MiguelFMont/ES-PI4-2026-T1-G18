# FinanceAI — Arquitetura

Documento de arquitetura do FinanceAI (ES-PI4-2026-T1-G18), em notação UML 2 (padrão Astah). Cada diagrama aparece em dois blocos: `mermaid` (renderiza no GitHub) e `plantuml` (mesma informação, serve para recriar o diagrama no Astah).


Fontes: seção 1 de [`../organizacao-sprints.md`](../organizacao-sprints.md) e [`../../README.md`](../../README.md).

## 1. Visão em camadas

O sistema tem quatro camadas de código/dados e dois grupos de serviços externos.

| Camada | Tecnologia | Porta | Quem acessa |
|---|---|---|---|
| Frontend | HTML, CSS e JavaScript (sem TypeScript, sem bundler, sem Axios) | servido pelo Backend | Navegador do usuário |
| Backend | TypeScript, Node.js, Express, Mongoose | 3001 | Frontend (HTTP/JWT) |
| Servidor Java | Java, sockets, threads, mensagens JSON | 3000 (só `127.0.0.1`) | Somente o Backend |
| Banco de dados | MongoDB Atlas | — | Somente o Backend (Mongoose) |
| Serviços externos | Pluggy (Open Finance, sandbox), API de IA generativa, serviço de e-mail (SMTP) | — | Somente o Backend |

```mermaid
flowchart TB
    subgraph L1["Camada 1 - Frontend"]
        FE["HTML / CSS / JS<br/>app, core, shared, features"]
    end
    subgraph L2["Camada 2 - Backend (porta 3001)"]
        BE["API REST Express + JWT<br/>routes, controller, service, repository"]
        JC["java-client<br/>pool de conexoes"]
    end
    subgraph L3["Camada 3 - Servidor Java (porta 3000)"]
        SJ["Aceitadora, Supervisora, HandlerRegistry<br/>handlers dos grupos"]
    end
    subgraph L4["Camada 4 - Banco de dados"]
        DB[("MongoDB Atlas")]
    end
    subgraph EXT["Servicos externos"]
        PL["Pluggy (Open Finance sandbox)"]
        IA["API de IA generativa"]
        SMTP["Servico de e-mail"]
    end
    FE -->|HTTP + JWT| BE
    BE --> JC
    JC -->|socket JSON| SJ
    BE -->|Mongoose| DB
    BE -->|HTTP externo| PL
    BE -->|HTTP externo| IA
    BE -->|SMTP| SMTP
```

```plantuml
@startuml
skinparam componentStyle uml2
title Visão em camadas
rectangle "Camada 1 - Frontend" as L1 {
  component "HTML / CSS / JS\napp, core, shared, features" as FE
}
rectangle "Camada 2 - Backend (porta 3001)" as L2 {
  component "API REST Express + JWT\nroutes, controller, service, repository" as BE
  component "java-client\npool de conexões" as JC
}
rectangle "Camada 3 - Servidor Java (porta 3000)" as L3 {
  component "Aceitadora, Supervisora,\nHandlerRegistry, handlers" as SJ
}
rectangle "Camada 4 - Banco de dados" as L4 {
  database "MongoDB Atlas" as DB
}
rectangle "Serviços externos" as EXT {
  component "Pluggy (Open Finance sandbox)" as PL
  component "API de IA generativa" as IA
  component "Serviço de e-mail" as SMTP
}
FE --> BE : HTTP + JWT
BE --> JC
JC --> SJ : socket JSON
BE --> DB : Mongoose
BE --> PL : HTTP externo
BE --> IA : HTTP externo
BE --> SMTP : SMTP
@enduml
```

## 2. Diagrama de componentes

Interfaces entre os componentes: HTTP com JWT (Frontend para Backend), sockets com mensagens JSON em linha (Backend para Servidor Java), Mongoose (Backend para MongoDB) e HTTP externo (Backend para Pluggy e IA).


```mermaid
flowchart LR
    subgraph FE["Frontend"]
        FE_app["app/main.js"]
        FE_core["core: http/api, session/storage,<br/>theme, preferencias, layout/menu"]
        FE_shared["shared/components"]
        FE_feat["features/feature:<br/>components, services, views, utils, styles"]
    end

    subgraph BE["Backend (TypeScript / Express)"]
        BE_http["http/app + http/frontend"]
        BE_mw["middlewares:<br/>authMiddleware, errorHandler"]
        BE_mod["modules: auth, suporte, transactions,<br/>connected-accounts, dashboard, mentor-ia,<br/>goals, investments, sistema"]
        BE_acc["modules/accounts"]
        BE_repo["repository + Model Mongoose"]
        BE_int["integrations: pluggy, genai.client,<br/>emailService"]
        BE_jc["java-client: javaServerClient<br/>(pool de Conexao)"]
    end

    subgraph SJ["Servidor Java"]
        SJ_core["core: Aceitadora, Supervisora,<br/>HandlerRegistry"]
        SJ_h["handlers: Auth, Transactions,<br/>Dashboard, Mentor, Goals, Investments"]
        SJ_pl["TransactionsHandler.calcularSaldoContas"]
    end

    DB[("MongoDB Atlas")]
    PL["Pluggy (sandbox)"]
    IA["API de IA generativa"]
    SMTP["Servico de e-mail"]

    FE_feat --> FE_core
    FE_feat --> FE_shared
    FE_app --> FE_core
    FE_core -->|"HTTP/JWT (fetch)"| BE_http
    BE_http --> BE_mw --> BE_mod
    BE_mod --> BE_repo
    BE_acc -.-> BE_repo
    BE_repo -->|Mongoose| DB
    BE_mod --> BE_int
    BE_mod --> BE_jc
    BE_acc -.-> BE_jc
    BE_int -->|HTTP externo| PL
    BE_int -->|HTTP externo| IA
    BE_int -->|SMTP| SMTP
    BE_jc -->|"socket JSON (127.0.0.1:3000)"| SJ_core
    SJ_core --> SJ_h
    SJ_core -.-> SJ_pl
    BE_http -.->|serve arquivos estaticos| FE_app
```

```plantuml
@startuml
skinparam componentStyle uml2
title Diagrama de componentes - FinanceAI

package "Frontend" {
  [app/main.js] as FE_app
  [core: http/api, session/storage,\ntheme, preferencias, layout/menu] as FE_core
  [shared/components] as FE_shared
  [features/<feature>:\ncomponents, services, views, utils, styles] as FE_feat
}

package "Backend (TypeScript / Express)" {
  [http/app + http/frontend] as BE_http
  [middlewares:\nauthMiddleware, errorHandler] as BE_mw
  [modules: auth, suporte, transactions,\nconnected-accounts, dashboard, mentor-ia,\ngoals, investments, sistema] as BE_mod
  [modules/accounts] as BE_acc
  [repository + Model Mongoose] as BE_repo
  [integrations: pluggy, genai.client,\nemailService] as BE_int
  [java-client: javaServerClient\n(pool de Conexao)] as BE_jc
}

package "Servidor Java" {
  [core: Aceitadora, Supervisora,\nHandlerRegistry] as SJ_core
  [handlers: Auth, Transactions, Dashboard,\nMentor, Goals, Investments] as SJ_h
  [TransactionsHandler.calcularSaldoContas] as SJ_pl
}

database "MongoDB Atlas" as DB
[Pluggy (sandbox)] as PL
[API de IA generativa] as IA
[Serviço de e-mail] as SMTP

FE_feat --> FE_core
FE_feat --> FE_shared
FE_app --> FE_core
FE_core --> BE_http : HTTP/JWT (fetch)
BE_http --> BE_mw
BE_mw --> BE_mod
BE_mod --> BE_repo
BE_acc ..> BE_repo
BE_repo --> DB : Mongoose
BE_mod --> BE_int
BE_mod --> BE_jc
BE_acc ..> BE_jc
BE_int --> PL : HTTP externo
BE_int --> IA : HTTP externo
BE_int --> SMTP : SMTP
BE_jc --> SJ_core : socket JSON\n(127.0.0.1:3000)
SJ_core --> SJ_h
SJ_core ..> SJ_pl
BE_http ..> FE_app : serve arquivos estáticos
@enduml
```

### Interfaces entre os componentes

| De | Para | Interface | Observação |
|---|---|---|---|
| Frontend (`api`) | Backend | HTTP/JSON com `Authorization: Bearer <JWT>` | `fetch` nativo, sem Axios; rotas sob `/v1` |
| Backend (`javaServerClient`) | Servidor Java | Socket TCP, uma linha JSON `{tipo, dados}` por mensagem | Pool de conexões duradouras, `PedidoXxx`/`RespostaXxx` |
| Backend (`repository`) | MongoDB Atlas | Mongoose (Model/Document) | Único ponto de acesso ao banco |
| Backend (`pluggyClient`) | Pluggy | HTTP externo | Sandbox com instituições fictícias |
| Backend (`genai.client`) | API de IA | HTTP externo | Resposta filtrada depois pelo Servidor Java |
| Backend (`emailService`) | Serviço de e-mail | SMTP | Confirmação de cadastro e recuperação de senha |
| Servidor Java | Backend | Mesma conexão de socket (resposta ou `Erro`) | O Servidor não conhece HTTP: devolve `code` + `message` |

## 3. Diagrama de implantação

O Servidor Java escuta apenas em loopback (`127.0.0.1`), por isso roda na mesma máquina do Backend. O Frontend não tem processo próprio: o Backend entrega os arquivos estáticos em `http://localhost:3001`.

```mermaid
flowchart TB
    subgraph CLI["Dispositivo do usuario"]
        NAV["Navegador<br/>Frontend HTML/CSS/JS"]
    end
    subgraph HOST["Maquina de execucao (mesmo host)"]
        subgraph NODE["Ambiente Node.js 20+"]
            BEA["Backend Express<br/>porta 3001 (HTTP /v1 + Frontend estatico)"]
        end
        subgraph JVM["JVM (JDK 17+)"]
            SJA["Servidor Java<br/>porta 3000 (127.0.0.1)"]
        end
    end
    subgraph NUVEM["Nuvem"]
        ATLAS[("MongoDB Atlas")]
        PLG["Pluggy API (sandbox)"]
        GEN["API de IA generativa"]
        MAIL["Servidor SMTP"]
    end
    NAV -->|"HTTP :3001 + JWT"| BEA
    BEA -->|"TCP :3000 JSON"| SJA
    BEA -->|"Mongoose (TLS)"| ATLAS
    BEA -->|HTTPS| PLG
    BEA -->|HTTPS| GEN
    BEA -->|SMTP| MAIL
```

```plantuml
@startuml
title Diagrama de implantação - FinanceAI
node "Dispositivo do usuário" {
  artifact "Frontend\n(HTML/CSS/JS)" as NAV
}
node "Máquina de execução (mesmo host)" {
  node "Node.js 20+" {
    artifact "Backend Express\nporta 3001" as BEA
  }
  node "JVM (JDK 17+)" {
    artifact "Servidor Java\nporta 3000 (127.0.0.1)" as SJA
  }
}
cloud "Nuvem" {
  database "MongoDB Atlas" as ATLAS
  node "Pluggy API (sandbox)" as PLG
  node "API de IA generativa" as GEN
  node "Servidor SMTP" as MAIL
}
NAV --> BEA : HTTP :3001 + JWT
BEA --> SJA : TCP :3000 (JSON)
BEA --> ATLAS : Mongoose (TLS)
BEA --> PLG : HTTPS
BEA --> GEN : HTTPS
BEA --> MAIL : SMTP
@enduml
```

Ordem de subida: Servidor Java (porta 3000), depois o Backend (porta 3001). Teste das camadas juntas: `curl localhost:3001/v1/health` e `POST /v1/eco` (Backend, socket, Servidor Java e volta).

## 4. Responsabilidades de cada camada

**Frontend**
- Telas web e interação do usuário; validação de formulário no cliente.
- Cada `service` de feature chama `api` (`fetch`) com o JWT guardado pela sessão (`storage`).
- Preferências locais (tema, ocultar valores sensíveis). Sem regra de negócio de cálculo.

**Backend (porta 3001)**
- API REST Express sob `/v1`, autenticação por JWT (`authMiddleware` coloca `userId` em `AuthenticatedRequest`).
- CRUD e acesso ao MongoDB via Mongoose (somente nos `repository`).
- Validação com zod (`*Schema` para `*Dto`) nos `controller`; regra de negócio nos `service`.
- Chama serviços externos: Pluggy (`pluggyClient`, `pluggy.mapper`), IA (`genai.client`), e-mail (`emailService`).
- Único cliente do Servidor Java (`javaServerClient`, pool de conexões) e tradutor dos `code` de erro em status HTTP (`error-codes`, `errorHandler`).
- Serve o Frontend (`http/frontend`).
-: módulo `accounts` (`/v1/accounts`, `POST /v1/transactions/transfers`), regra `PLAN_REQUIRED` para conta Open Finance.

**Servidor Java (porta 3000)**
- Operações puras sobre os dados recebidos no pedido: hash e validação de senha (PBKDF2), categorização, indicadores e comparação de períodos, contexto e filtro da IA, progresso de meta, rentabilidade simulada, parcelamentos.
- Não acessa banco, não conhece HTTP, aceita só `127.0.0.1`.
-: cálculo do saldo das contas (`PedidoCalcularSaldoContas`, `TransactionsHandler.calcularSaldoContas`).

**MongoDB Atlas**
- Coleções isoladas por feature: users, pending registrations, transactions, connected_accounts, goals, investments, cards, card installments, chat messages, alerts, suporte;: accounts.
- Acessado só pelo Backend.

**Serviços externos**
- Pluggy: widget de conexão, itens, contas e transações importadas (sandbox).
- API de IA: respostas do Mentor e mensagens proativas.
- E-mail: confirmação de cadastro e recuperação de senha.

## 5. Fluxo de uma requisição que usa o Servidor Java

```mermaid
sequenceDiagram
    participant FE as Frontend service
    participant API as api (fetch)
    participant R as Express router
    participant MW as authMiddleware
    participant C as controller
    participant S as service
    participant REPO as repository / Model
    participant DB as MongoDB
    participant JC as javaServerClient
    participant SUP as Supervisora (Java)
    participant H as handler do grupo
    FE->>API: chamada
    API->>R: HTTP + Authorization Bearer
    R->>MW: valida JWT
    MW->>C: userId
    C->>C: schema.parse (Dto)
    C->>S: caso de uso
    S->>REPO: ler dados
    REPO->>DB: Mongoose
    DB-->>REPO: documentos
    S->>JC: enviarPedido(tipoPedido, tipoResposta, dados)
    JC->>JC: obter() Conexao livre do pool
    JC->>SUP: linha JSON {tipo, dados}
    SUP->>H: registry.obter(tipo).tratar(pedido)
    H-->>SUP: resposta
    SUP-->>JC: linha JSON
    JC->>JC: devolver(conexao)
    JC-->>S: resposta (ou AppError)
    S->>REPO: gravar / compor DTO
    S-->>C: DTO
    C-->>API: JSON
    API-->>FE: renderiza
```

```plantuml
@startuml
title Fluxo de uma requisição que usa o Servidor Java
participant "Frontend service" as FE
participant "api (fetch)" as API
participant "Express router" as R
participant "authMiddleware" as MW
participant "controller" as C
participant "service" as S
participant "repository / Model" as REPO
database "MongoDB" as DB
participant "javaServerClient" as JC
participant "Supervisora (Java)" as SUP
participant "handler do grupo" as H
FE -> API : chamada
API -> R : HTTP + Authorization Bearer
R -> MW : valida JWT
MW -> C : userId
C -> C : schema.parse (Dto)
C -> S : caso de uso
S -> REPO : ler dados
REPO -> DB : Mongoose
DB --> REPO : documentos
S -> JC : enviarPedido(tipoPedido, tipoResposta, dados)
JC -> JC : obter() Conexao livre do pool
JC -> SUP : linha JSON {tipo, dados}
SUP -> H : registry.obter(tipo).tratar(pedido)
H --> SUP : resposta
SUP --> JC : linha JSON
JC -> JC : devolver(conexao)
JC --> S : resposta (ou AppError)
S -> REPO : gravar / compor DTO
S --> C : DTO
C --> API : JSON
API --> FE : renderiza
@enduml
```

Detalhe do pool (`javaServerClient`):
- `obter()` pega uma `Conexao` livre, até `env.JAVA_SERVER_POOL_SIZE`. Se não há livre e o pool não está cheio, abre uma nova; senão o pedido espera em fila (`esperando`).
- `Conexao.enviar` escreve `{tipo, dados}` pelo `Parceiro` do Backend (uma linha JSON). No Servidor, a `Supervisora` lê com `Parceiro.envie()`, chama `registry.obter(tipo).tratar(pedido)` e responde com `Parceiro.receba(resposta)`. Os nomes `receba`/`envie` são herdados do exemplo do professor: `receba(x)` manda ao outro lado e `envie()` lê.
- Se a resposta for do tipo `Erro`, o Backend traduz o `code` em status (`statusDoCodigo`, em `error-codes`) e lança `AppError`. Se o tipo for diferente do esperado: `502 JAVA_SERVER_ERROR`.
- Fluxos sem Servidor Java (CRUD puro: listar transações, metas, suporte) terminam no `repository`.

### Robustez

| Situação | Comportamento |
|---|---|
| Timeout por pedido (`JAVA_SERVER_TIMEOUT_MS`) | A conexão é morta (evita resposta desalinhada) |
| `FalhaDeTransporte` | Uma segunda tentativa; depois `503 JAVA_SERVER_UNAVAILABLE` |
| `ComunicadoDeDesligamento` | O Backend descarta a conexão (`503 JAVA_SERVER_SHUTTING_DOWN`) |
| Conexão ociosa por 5 min | O Servidor fecha; o pool reconecta |
| Encerramento do Backend | `javaServerClient.fechar()` manda `PedidoParaSair` em cada conexão |
| Servidor fora do ar na categorização | Categoria cai para `Outros` (RNF05) |

## 6. Decisões de arquitetura

| Decisão | Motivo |
|---|---|
| Servidor Java sem banco de dados | Fica como "fazedor de continhas": operações puras sobre os dados do pedido. O banco e o CRUD ficam no Backend, que é o único dono do MongoDB. Confirmado pelo professor. |
| Mensagens JSON por socket, não serialização nativa | `ObjectOutputStream` só funciona entre programas Java; o Backend é TypeScript. A estrutura de threads (Aceitadora, Supervisora, Parceiro) foi mantida igual à do exemplo. |
| Pool de conexões duradouras no Backend | Evita abrir um socket por pedido; cada conexão atende um pedido por vez (sem mistura de respostas) e o pool limita a concorrência (`JAVA_SERVER_POOL_SIZE`). |
| Uma `Supervisora` por conexão e `HandlerRegistry` | Despacho por tipo de mensagem; cada grupo registra seu handler com uma linha, sem editar o mesmo arquivo. |
| Servidor só em `127.0.0.1` | Só o Backend se conecta; não há exposição externa. |
| Backend serve o Frontend | Uma só origem (`http://localhost:3001`), sem CORS nem bundler; Frontend em HTML/CSS/JS puro. |
| Frontend sem Axios | `fetch` nativo encapsulado em `core/http/api` (com `ApiError`). |
| Erros do Servidor como `code` + `message` | O Servidor não conhece HTTP; o Backend traduz o `code` em status. |
| `repository` é o único que fala com o MongoDB | Camadas `routes`, `controller`, `service`, `repository` por módulo; coleções isoladas por feature. |
| Degradação na categorização | Servidor indisponível não bloqueia o lançamento: categoria `Outros` (RNF05). |

## 7. Estrutura de pastas por camada

**Frontend** (`Frontend/src`)
```
app/                    main.js
core/                   http (api, ApiError), session (storage, login), theme,
                        preferencias, privacy (valores), layout (menu), views (includes)
shared/                 components (Calendario, campos, notificacao, seletor,
                        dateRange, entrada, moeda, rolagem)
features/<feature>/     components, services, views, utils, styles
                        (auth/Perfil, transactions, contas-conectadas, dashboard,
                         mentor-ia, goals, investments)
```

**Backend** (`Backend/src`)
```
config/                 env (variáveis validadas com zod)
database/               mongo.connection
shared/errors/          app-error, error-codes
java-client/            Comunicado, Parceiro, javaServerClient (pool)
http/                   app, server, frontend
middlewares/            auth.middleware, error-handler.middleware
integrations/           pluggy (pluggyClient, pluggy.mapper), genai.client, emailService
modules/                index.ts (monta os routers sob /v1)
  sistema/              /v1/health e /v1/eco
  auth/  suporte/  transactions/  connected-accounts/
  dashboard/  mentor-ia/  goals/  investments/
  accounts/            
```
Cada módulo: `routes`, `controller`, `service`, `repository`, `model`, `dto`.

**Servidor Java** (`Servidor/src/main/java/com/financeai`)
```
Main.java               porta padrão 3000; sobe Aceitadora e lê o console
core/                   Comunicado, Parceiro, Aceitadora, Supervisora,
                        HandlerRegistry, Handler, ErroDeNegocio, EcoHandler, Teclado
auth/                   AuthHandler, PedidoHashSenha, PedidoValidarSenha (+ Respostas)
transactions/           TransactionsHandler, PedidoCategorizarTransacao (+ Resposta);
                        PedidoCalcularSaldoContas (+ Resposta)
dashboard/              DashboardHandler, PedidoCalcularIndicadores, PedidoCompararPeriodos
mentoria/               MentorHandler, FiltroDeAtivos, FiltroDeEscopo,
                        PedidoMontarContextoIA, PedidoFiltrarResposta
goals/                  GoalsHandler, PedidoProgressoMeta
investments/            InvestmentsHandler, PedidoRentabilidadeSimulada,
                        PedidoCalcularParcelamentos
```

**Banco de dados (MongoDB Atlas)**: coleções users, pending registrations, transactions, connected_accounts, goals, investments, cards, card installments, chat messages, alerts, suporte e,, accounts.
