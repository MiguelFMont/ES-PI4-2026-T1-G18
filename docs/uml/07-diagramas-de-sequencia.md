# 07 - Diagramas de sequência

Diagramas de sequência (UML 2) do FinanceAI. Cada diagrama aparece em dois blocos: `mermaid` (renderiza no GitHub) e `plantuml` (descreve o mesmo diagrama e serve para recriá-lo no Astah, em *Sequence Diagram*).

Convenções:

- Linhas de vida usam os nomes reais de arquivos e funções do código.
- `Parceiro.receba(x)` envia ao outro lado e `Parceiro.envie()` lê (nomes herdados do exemplo do professor, ver `00-README.md`).

---

## 1. Login (UC02)

Participantes: Usuário, `inicio.js` (Frontend), `api`, `authRouter`, `authController`, `authService`, `authRepository`, MongoDB, `javaServerClient`, `Supervisora`, `AuthHandler`.

Observação: o cadastro (UC01) é análogo, com `PedidoHashSenha`, `PendingRegistrationModel` e `emailService`.

```mermaid
sequenceDiagram
    actor U as Usuário
    participant FE as inicio.js (Frontend)
    participant API as api
    participant RT as authRouter
    participant CT as authController
    participant SV as authService
    participant RP as authRepository
    participant DB as MongoDB
    participant JC as javaServerClient
    participant SU as Supervisora
    participant AH as AuthHandler

    U->>FE: envia e-mail e senha no formulário
    FE->>API: POST /v1/auth/login
    API->>RT: requisição HTTP
    RT->>CT: login(req, res)
    CT->>CT: loginSchema.parse(body) gera LoginDto
    alt dados inválidos
        CT-->>API: 400 VALIDATION_ERROR
    end
    CT->>SV: login(dados)
    SV->>RP: findByEmail(email)
    RP->>DB: consulta UserModel
    DB-->>RP: usuário ou null
    RP-->>SV: usuário ou null
    alt usuário null
        SV-->>CT: AppError 401 INVALID_CREDENTIALS
    end
    SV->>JC: enviarPedido(PedidoValidarSenha, RespostaValidarSenha, senha+hash+sal)
    JC->>JC: obter() pega Conexao do pool
    JC->>SU: Parceiro - linha JSON {tipo, dados}
    SU->>AH: HandlerRegistry.obter(tipo) e validarSenha (PBKDF2)
    AH-->>SU: RespostaValidarSenha {valido}
    SU-->>JC: Parceiro.receba(resposta)
    JC->>JC: devolver(conexao)
    JC-->>SV: RespostaValidarSenha
    alt Servidor Java fora
        SV-->>CT: AppError 503 JAVA_SERVER_UNAVAILABLE
    else valido = false
        SV-->>CT: AppError 401 INVALID_CREDENTIALS
    end
    SV->>SV: gera JWT (jsonwebtoken, segredo do env)
    SV-->>CT: {token, usuario}
    CT-->>API: 200 {token, usuario}
    API-->>FE: resposta
    FE->>FE: storage.salvarSessao(token)
    FE-->>U: redireciona para o painel
```

```plantuml
@startuml
title Login (UC02)
actor "Usuário" as U
participant "inicio.js\n(Frontend)" as FE
participant "api" as API
participant "authRouter" as RT
participant "authController" as CT
participant "authService" as SV
participant "authRepository" as RP
database "MongoDB" as DB
participant "javaServerClient" as JC
participant "Supervisora" as SU
participant "AuthHandler" as AH

U -> FE : envia e-mail e senha no formulário
FE -> API : POST /v1/auth/login
API -> RT : requisição HTTP
RT -> CT : login(req, res)
CT -> CT : loginSchema.parse(body) gera LoginDto
alt dados inválidos
  CT --> API : 400 VALIDATION_ERROR
end
CT -> SV : login(dados)
SV -> RP : findByEmail(email)
RP -> DB : consulta UserModel
DB --> RP : usuário ou null
RP --> SV : usuário ou null
alt usuário null
  SV --> CT : AppError 401 INVALID_CREDENTIALS
end
SV -> JC : enviarPedido(PedidoValidarSenha, RespostaValidarSenha, senha+hash+sal)
JC -> JC : obter() pega Conexao do pool
JC -> SU : Parceiro - linha JSON {tipo, dados}
SU -> AH : HandlerRegistry.obter(tipo) e validarSenha (PBKDF2)
AH --> SU : RespostaValidarSenha {valido}
SU --> JC : Parceiro.receba(resposta)
JC -> JC : devolver(conexao)
JC --> SV : RespostaValidarSenha
alt Servidor Java fora
  SV --> CT : AppError 503 JAVA_SERVER_UNAVAILABLE
else valido = false
  SV --> CT : AppError 401 INVALID_CREDENTIALS
end
SV -> SV : gera JWT (jsonwebtoken, segredo do env)
SV --> CT : {token, usuario}
CT --> API : 200 {token, usuario}
API --> FE : resposta
FE -> FE : storage.salvarSessao(token)
FE --> U : redireciona para o painel
@enduml
```

---

## 2. Criar transação com categorização no Servidor Java (UC08 + UC10)

Participantes: Usuário, `TransactionForm`, `transactionsService` (Frontend), `api`, `authMiddleware`, `transactionsController`, `transactionsService` (Backend), `javaServerClient`, `Supervisora`, `TransactionsHandler`, `transactionsRepository`, MongoDB.

Nota: depois da validação do corpo, `accountsRepository` confirma `contaId` (422 `ACCOUNT_REQUIRED` ou 404 `ACCOUNT_NOT_FOUND`).

```mermaid
sequenceDiagram
    actor U as Usuário
    participant TF as TransactionForm
    participant FS as transactionsService (Frontend)
    participant API as api
    participant AM as authMiddleware
    participant CT as transactionsController
    participant SV as transactionsService (Backend)
    participant AR as accountsRepository
    participant JC as javaServerClient
    participant SU as Supervisora
    participant TH as TransactionsHandler
    participant RP as transactionsRepository
    participant DB as MongoDB

    U->>TF: Lançamento > Nova despesa, preenche e salva
    TF->>TF: formValidation valida no cliente
    TF->>FS: criar lançamento
    FS->>API: POST /v1/transactions (Bearer)
    API->>AM: requisição HTTP
    AM->>AM: valida JWT e define userId
    alt token inválido
        AM-->>API: 401 UNAUTHENTICATED
    end
    AM->>CT: create(req, res)
    CT->>CT: createTransactionSchema.parse gera CreateTransactionDto
    Note over CT,AR: confirma contaId do usuário
    CT->>AR: buscar conta por contaId e userId
    AR-->>CT: conta, ou 422 ACCOUNT_REQUIRED / 404 ACCOUNT_NOT_FOUND
    CT->>SV: create(userId, dto)
    opt categoria vazia
        SV->>SV: sugerirCategoria(descricao, valor)
        SV->>JC: enviarPedido(PedidoCategorizarTransacao, RespostaCategorizarTransacao, dados)
        JC->>JC: obter() pega Conexao do pool
        JC->>SU: linha JSON {tipo, dados}
        SU->>TH: HandlerRegistry.obter(tipo) e categorizar
        TH-->>SU: RespostaCategorizarTransacao {categoria}
        SU-->>JC: resposta
        JC->>JC: devolver(conexao)
        JC-->>SV: categoria
        alt falha ou Servidor indisponível (RNF05)
            SV->>SV: categoria = Outros
        end
    end
    opt forma de pagamento crédito parcelado
        SV->>SV: monta PlanoDaTransacao e parcelas (vínculo cartaoId)
    end
    SV->>RP: create(...)
    RP->>DB: grava TransactionModel
    DB-->>RP: documento
    RP-->>SV: documento
    SV-->>CT: TransactionResponseDto
    CT-->>API: 201 TransactionResponseDto
    API-->>FS: resposta
    FS-->>TF: lançamento criado
    TF->>TF: atualiza TransactionLista e TransactionResumo
    TF-->>U: mostra notificacao
```

```plantuml
@startuml
title Criar transação com categorização no Servidor Java (UC08 + UC10)
actor "Usuário" as U
participant "TransactionForm" as TF
participant "transactionsService\n(Frontend)" as FS
participant "api" as API
participant "authMiddleware" as AM
participant "transactionsController" as CT
participant "transactionsService\n(Backend)" as SV
participant "accountsRepository\n" as AR
participant "javaServerClient" as JC
participant "Supervisora" as SU
participant "TransactionsHandler" as TH
participant "transactionsRepository" as RP
database "MongoDB" as DB

U -> TF : Lançamento > Nova despesa, preenche e salva
TF -> TF : formValidation valida no cliente
TF -> FS : criar lançamento
FS -> API : POST /v1/transactions (Bearer)
API -> AM : requisição HTTP
AM -> AM : valida JWT e define userId
alt token inválido
  AM --> API : 401 UNAUTHENTICATED
end
AM -> CT : create(req, res)
CT -> CT : createTransactionSchema.parse gera CreateTransactionDto
note over CT, AR : confirma contaId do usuário
CT -> AR : buscar conta por contaId e userId
AR --> CT : conta, ou 422 ACCOUNT_REQUIRED / 404 ACCOUNT_NOT_FOUND
CT -> SV : create(userId, dto)
opt categoria vazia
  SV -> SV : sugerirCategoria(descricao, valor)
  SV -> JC : enviarPedido(PedidoCategorizarTransacao, RespostaCategorizarTransacao, dados)
  JC -> JC : obter() pega Conexao do pool
  JC -> SU : linha JSON {tipo, dados}
  SU -> TH : HandlerRegistry.obter(tipo) e categorizar
  TH --> SU : RespostaCategorizarTransacao {categoria}
  SU --> JC : resposta
  JC -> JC : devolver(conexao)
  JC --> SV : categoria
  alt falha ou Servidor indisponível (RNF05)
    SV -> SV : categoria = Outros
  end
end
opt forma de pagamento crédito parcelado
  SV -> SV : monta PlanoDaTransacao e parcelas (vínculo cartaoId)
end
SV -> RP : create(...)
RP -> DB : grava TransactionModel
DB --> RP : documento
RP --> SV : documento
SV --> CT : TransactionResponseDto
CT --> API : 201 TransactionResponseDto
API --> FS : resposta
FS --> TF : lançamento criado
TF -> TF : atualiza TransactionLista e TransactionResumo
TF --> U : mostra notificacao
@enduml
```

---

## 3. Chat com o Mentor Financeiro (UC20)

Participantes: Usuário, `MentorEntrada`/`MentorConversa`, `mentorIaService` (Frontend), `api`, `mentorIaController`, `mentorIaService` (Backend), `mentorIaRepository`, `transactionsRepository`/MongoDB, `javaServerClient`, `MentorHandler`, `genai.client`, API de IA generativa.

No Backend, `montarContexto` e `filtrarResposta` são funções internas de `mentorIaService` que chamam o Servidor Java.

```mermaid
sequenceDiagram
    actor U as Usuário
    participant ME as MentorEntrada / MentorConversa
    participant FS as mentorIaService (Frontend)
    participant API as api
    participant CT as mentorIaController
    participant SV as mentorIaService (Backend)
    participant MR as mentorIaRepository
    participant TR as transactionsRepository
    participant DB as MongoDB
    participant JC as javaServerClient
    participant MH as MentorHandler
    participant GA as genai.client
    participant IA as API de IA generativa

    U->>ME: digita a pergunta
    ME->>FS: enviar mensagem
    FS->>API: POST /v1/mentor-ia/chat
    API->>CT: sendMessage(req, res)
    CT->>CT: chatMessageSchema.parse gera ChatMessageDto
    CT->>SV: sendMessage(userId, texto)
    SV->>MR: grava mensagem do usuário
    MR->>DB: ChatMessageModel
    SV->>TR: lê transações recentes
    TR->>DB: TransactionModel
    DB-->>SV: transações
    SV->>SV: monta TransacaoResumida[] e histórico MensagemAnterior[]
    SV->>JC: enviarPedido(PedidoMontarContextoIA, RespostaMontarContextoIA)
    JC->>MH: via Supervisora e HandlerRegistry - montarContexto
    MH-->>JC: RespostaMontarContextoIA {contexto}
    JC-->>SV: contexto
    SV->>GA: gerar texto (contexto + histórico + pergunta)
    GA->>IA: requisição de geração
    alt erro ou IA indisponível
        IA-->>GA: falha
        GA-->>SV: erro
        SV-->>CT: AppError 503
    else sucesso
        IA-->>GA: texto gerado
        GA-->>SV: texto
    end
    SV->>JC: enviarPedido(PedidoFiltrarResposta, RespostaFiltrarResposta)
    JC->>MH: via Supervisora e HandlerRegistry - filtrarResposta (FiltroDeAtivos, FiltroDeEscopo - RF22)
    MH-->>JC: RespostaFiltrarResposta {respostaFiltrada}
    JC-->>SV: respostaFiltrada
    SV->>MR: grava resposta do assistente
    MR->>DB: ChatMessageModel
    SV-->>CT: ChatReplyResponseDto
    CT-->>API: 200 ChatReplyResponseDto
    API-->>FS: resposta
    FS-->>ME: resposta
    ME-->>U: MentorConversa renderiza com markdown
```

```plantuml
@startuml
title Chat com o Mentor Financeiro (UC20)
actor "Usuário" as U
participant "MentorEntrada /\nMentorConversa" as ME
participant "mentorIaService\n(Frontend)" as FS
participant "api" as API
participant "mentorIaController" as CT
participant "mentorIaService\n(Backend)" as SV
participant "mentorIaRepository" as MR
participant "transactionsRepository" as TR
database "MongoDB" as DB
participant "javaServerClient" as JC
participant "MentorHandler" as MH
participant "genai.client" as GA
participant "API de IA generativa" as IA

U -> ME : digita a pergunta
ME -> FS : enviar mensagem
FS -> API : POST /v1/mentor-ia/chat
API -> CT : sendMessage(req, res)
CT -> CT : chatMessageSchema.parse gera ChatMessageDto
CT -> SV : sendMessage(userId, texto)
SV -> MR : grava mensagem do usuário
MR -> DB : ChatMessageModel
SV -> TR : lê transações recentes
TR -> DB : TransactionModel
DB --> SV : transações
SV -> SV : monta TransacaoResumida[] e histórico MensagemAnterior[]
SV -> JC : enviarPedido(PedidoMontarContextoIA, RespostaMontarContextoIA)
JC -> MH : via Supervisora e HandlerRegistry - montarContexto
MH --> JC : RespostaMontarContextoIA {contexto}
JC --> SV : contexto
SV -> GA : gerar texto (contexto + histórico + pergunta)
GA -> IA : requisição de geração
alt erro ou IA indisponível
  IA --> GA : falha
  GA --> SV : erro
  SV --> CT : AppError 503
else sucesso
  IA --> GA : texto gerado
  GA --> SV : texto
end
SV -> JC : enviarPedido(PedidoFiltrarResposta, RespostaFiltrarResposta)
JC -> MH : via Supervisora e HandlerRegistry - filtrarResposta (FiltroDeAtivos, FiltroDeEscopo - RF22)
MH --> JC : RespostaFiltrarResposta {respostaFiltrada}
JC --> SV : respostaFiltrada
SV -> MR : grava resposta do assistente
MR -> DB : ChatMessageModel
SV --> CT : ChatReplyResponseDto
CT --> API : 200 ChatReplyResponseDto
API --> FS : resposta
FS --> ME : resposta
ME --> U : MentorConversa renderiza com markdown
@enduml
```

---

## 4. Fatura do cartão de crédito (UC26 + UC27)

Participantes: Usuário, `InvestmentsPage`/`CartoesLista`/`CartaoCompras`, `investmentsService` (Frontend), `api`, `investmentsController`, `investmentsService` (Backend), `investmentsRepository`, MongoDB, `javaServerClient`, `InvestmentsHandler`.

```mermaid
sequenceDiagram
    actor U as Usuário
    participant PG as InvestmentsPage / CartoesLista / CartaoCompras
    participant FS as investmentsService (Frontend)
    participant API as api
    participant CT as investmentsController
    participant SV as investmentsService (Backend)
    participant RP as investmentsRepository
    participant DB as MongoDB
    participant JC as javaServerClient
    participant IH as InvestmentsHandler

    U->>PG: abre a tela Cartões
    PG->>FS: listar cartões
    FS->>API: GET /v1/investments/cards
    API->>CT: listCards(req, res)
    CT->>SV: listCards(userId)
    SV->>RP: cartões do usuário (CardModel, até 5)
    RP->>DB: consulta CardModel
    DB-->>SV: cartões
    SV->>RP: compras e parcelas no crédito de cada cartão
    RP->>DB: CardInstallmentModel e transações com cartaoId
    DB-->>SV: ComprasDoCartao / ContextoParcelamentos
    loop para cada cartão
        SV->>SV: monta ParcelamentoParaCalculo[]
        SV->>JC: enviarPedido(PedidoCalcularParcelamentos, RespostaCalcularParcelamentos)
        JC->>IH: via Supervisora e HandlerRegistry - calcularParcelamentos
        IH-->>JC: RespostaCalcularParcelamentos (ParcelamentoCalculado: parcela atual, juros, saldo devedor)
        JC-->>SV: parcelamentos calculados
        SV->>SV: calcula fatura do mês, vencimento e limite disponível (limite - saldo devedor)
    end
    alt Servidor Java indisponível
        SV-->>CT: AppError 503
        CT-->>API: 503 JAVA_SERVER_UNAVAILABLE
        API-->>PG: erro
        PG-->>U: a tela mostra o erro
    else sucesso
        SV-->>CT: CardsResponseDto (CardResponseDto por cartão)
        CT-->>API: 200 CardsResponseDto
        API-->>FS: resposta
        FS-->>PG: cartões
        PG-->>U: CartoesLista mostra fatura e limite
    end
    U->>PG: abre um cartão
    PG->>FS: listar compras
    FS->>API: GET /v1/investments/installments?cartaoId
    API-->>PG: compras do cartão
    PG-->>U: CartaoCompras lista as compras
```

```plantuml
@startuml
title Fatura do cartão de crédito (UC26 + UC27)
actor "Usuário" as U
participant "InvestmentsPage /\nCartoesLista /\nCartaoCompras" as PG
participant "investmentsService\n(Frontend)" as FS
participant "api" as API
participant "investmentsController" as CT
participant "investmentsService\n(Backend)" as SV
participant "investmentsRepository" as RP
database "MongoDB" as DB
participant "javaServerClient" as JC
participant "InvestmentsHandler" as IH

U -> PG : abre a tela Cartões
PG -> FS : listar cartões
FS -> API : GET /v1/investments/cards
API -> CT : listCards(req, res)
CT -> SV : listCards(userId)
SV -> RP : cartões do usuário (CardModel, até 5)
RP -> DB : consulta CardModel
DB --> SV : cartões
SV -> RP : compras e parcelas no crédito de cada cartão
RP -> DB : CardInstallmentModel e transações com cartaoId
DB --> SV : ComprasDoCartao / ContextoParcelamentos
loop para cada cartão
  SV -> SV : monta ParcelamentoParaCalculo[]
  SV -> JC : enviarPedido(PedidoCalcularParcelamentos, RespostaCalcularParcelamentos)
  JC -> IH : via Supervisora e HandlerRegistry - calcularParcelamentos
  IH --> JC : RespostaCalcularParcelamentos (ParcelamentoCalculado: parcela atual, juros, saldo devedor)
  JC --> SV : parcelamentos calculados
  SV -> SV : calcula fatura do mês, vencimento e limite disponível (limite - saldo devedor)
end
alt Servidor Java indisponível
  SV --> CT : AppError 503
  CT --> API : 503 JAVA_SERVER_UNAVAILABLE
  API --> PG : erro
  PG --> U : a tela mostra o erro
else sucesso
  SV --> CT : CardsResponseDto (CardResponseDto por cartão)
  CT --> API : 200 CardsResponseDto
  API --> FS : resposta
  FS --> PG : cartões
  PG --> U : CartoesLista mostra fatura e limite
end
U -> PG : abre um cartão
PG -> FS : listar compras
FS -> API : GET /v1/investments/installments?cartaoId
API --> PG : compras do cartão
PG --> U : CartaoCompras lista as compras
@enduml
```

---

## 5. Transferência entre contas (UC31)


Participantes: Usuário, `TransactionBarra` (menu Lançamento), `TransferenciaForm`, `transactionsService` (Frontend), `api`, `transactionsController`, `transactionsService` (Backend), `accountsRepository`, `transactionsRepository`, MongoDB, `javaServerClient`, `TransactionsHandler`.

```mermaid
sequenceDiagram
    actor U as Usuário
    participant TB as TransactionBarra (menu Lançamento)
    participant TFM as TransferenciaForm
    participant FS as transactionsService (Frontend)
    participant API as api
    participant CT as transactionsController
    participant SV as transactionsService (Backend)
    participant AR as accountsRepository
    participant AS as accountsService
    participant RP as transactionsRepository
    participant DB as MongoDB
    participant JC as javaServerClient
    participant TH as TransactionsHandler

    Note over U,TH: Transferência entre contas
    U->>TB: Lançamento > Nova transferência (ou atalho T)
    TB->>TFM: abre o modal
    opt menos de duas contas manuais
        TFM-->>U: leva a Contas Conectadas > Nova conta
    end
    U->>TFM: conta de origem, destino, valor, data, descrição e observação
    TFM->>FS: criar transferência
    FS->>API: POST /v1/transactions/transfers {contaId, contaDestinoId, valor, data, descricao?, observacoes?}
    API->>CT: createTransfer
    CT->>CT: createTransferSchema.parse - contas diferentes e valor maior que 0
    alt validação falha
        CT-->>API: 400 VALIDATION_ERROR
    end
    CT->>SV: createTransfer(userId, dto)
    SV->>AR: busca as duas contas do userId
    AR->>DB: consulta AccountModel
    DB-->>AR: contas
    AR-->>SV: contas
    alt conta não encontrada
        SV-->>CT: AppError 404 ACCOUNT_NOT_FOUND
    else alguma conta é open_finance
        SV-->>CT: AppError 422 TRANSFER_NOT_ALLOWED
    end
    SV->>RP: create - registro único tipo transferencia (contaId e contaDestinoId)
    RP->>DB: grava TransactionModel
    DB-->>RP: documento
    RP-->>SV: transferência
    SV->>AS: recalcular saldos
    AS->>JC: enviarPedido(PedidoCalcularSaldoContas, RespostaCalcularSaldoContas, {contas, movimentos})
    JC->>TH: via Supervisora e HandlerRegistry - calcularSaldoContas
    TH-->>JC: RespostaCalcularSaldoContas {saldos}
    JC-->>AS: saldos
    AS-->>SV: saldos
    SV-->>CT: transferência e saldos
    CT-->>API: 201 transferência e saldos
    API-->>FS: resposta
    FS-->>TFM: sucesso
    TFM-->>U: lista mostra tipo Transferência e coluna Origem com a conta
    Note over U,TH: resumo e painel não somam a transferência (RN6)
```

```plantuml
@startuml
title Transferência entre contas (UC31)
actor "Usuário" as U
participant "TransactionBarra\n(menu Lançamento)" as TB
participant "TransferenciaForm\n" as TFM
participant "transactionsService\n(Frontend)" as FS
participant "api" as API
participant "transactionsController" as CT
participant "transactionsService\n(Backend)" as SV
participant "accountsRepository\n" as AR
participant "accountsService\n" as AS
participant "transactionsRepository" as RP
database "MongoDB" as DB
participant "javaServerClient" as JC
participant "TransactionsHandler" as TH

note over U, TH : Transferência entre contas
U -> TB : Lançamento > Nova transferência (ou atalho T)
TB -> TFM : abre o modal
opt menos de duas contas manuais
  TFM --> U : leva a Contas Conectadas > Nova conta
end
U -> TFM : conta de origem, destino, valor, data, descrição e observação
TFM -> FS : criar transferência
FS -> API : POST /v1/transactions/transfers {contaId, contaDestinoId, valor, data, descricao?, observacoes?}
API -> CT : createTransfer
CT -> CT : createTransferSchema.parse - contas diferentes e valor maior que 0
alt validação falha
  CT --> API : 400 VALIDATION_ERROR
end
CT -> SV : createTransfer(userId, dto)
SV -> AR : busca as duas contas do userId
AR -> DB : consulta AccountModel
DB --> AR : contas
AR --> SV : contas
alt conta não encontrada
  SV --> CT : AppError 404 ACCOUNT_NOT_FOUND
else alguma conta é open_finance
  SV --> CT : AppError 422 TRANSFER_NOT_ALLOWED
end
SV -> RP : create - registro único tipo transferencia (contaId e contaDestinoId)
RP -> DB : grava TransactionModel
DB --> RP : documento
RP --> SV : transferência
SV -> AS : recalcular saldos
AS -> JC : enviarPedido(PedidoCalcularSaldoContas, RespostaCalcularSaldoContas, {contas, movimentos})
JC -> TH : via Supervisora e HandlerRegistry - calcularSaldoContas
TH --> JC : RespostaCalcularSaldoContas {saldos}
JC --> AS : saldos
AS --> SV : saldos
SV --> CT : transferência e saldos
CT --> API : 201 transferência e saldos
API --> FS : resposta
FS --> TFM : sucesso
TFM --> U : lista mostra tipo Transferência e coluna Origem com a conta
note over U, TH : resumo e painel não somam a transferência (RN6)
@enduml
```
