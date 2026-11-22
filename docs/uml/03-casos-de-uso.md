# Casos de uso — FinanceAI

Modelagem de casos de uso (UML 2, padrão Astah) do FinanceAI. Fontes: `docs/documento-de-visao.md` (requisitos RF01 a RF42) e `docs/especificacao-contas-e-transferencias.md` (contas e transferências, issues #101 a #115).

Legenda de estado:

- sem marca: caso de uso já existente no código;
- «planejado»: ainda não existe no código (contas e transferências, Sprint 5);
- «futuro»: feature futura, sem código ou sem interface (RF04, RF08, RF25 e RF26).

> O Mermaid não possui diagrama de casos de uso. Cada diagrama abaixo aparece em dois blocos: um `flowchart` Mermaid (renderiza no GitHub, com atores em losango arredondado e casos de uso em elipse) e o PlantUML equivalente, que serve para recriar o diagrama no Astah. Nos blocos Mermaid e PlantUML os estereótipos aparecem sem as aspas angulares (include, extend, planejado, futuro) por limitação de sintaxe.

## 1. Atores

| Ator | Tipo | Descrição |
|---|---|---|
| Visitante | Primário | Pessoa ainda não autenticada. Cria a conta (RF01), confirma o e-mail, faz login (RF02) e recupera a senha (RF03). Depois do login passa a ser Usuário do plano Free ou Pro. |
| Usuário do plano Free | Primário (ator-base) | Usuário autenticado com plano `free` (`UserModel.plano`). Usa os casos de uso do núcleo: transações, painel, Mentor, metas, cartões, perfil, suporte e, quando implementado, contas manuais e transferências. |
| Usuário do plano Pro | Primário (especialização) | Generalização do Usuário do plano Free: herda todos os casos de uso e é o único que pode criar uma conta Open Finance pela Pluggy (RF39, RN3; «planejado»). No Astah: seta de generalização Usuário do plano Pro -> Usuário do plano Free. |
| Servidor Java | Secundário (sistema) | Processo separado que recebe pedidos JSON por socket e devolve o resultado de operações puras: hash e validação de senha, categorização, indicadores e comparação de períodos, contexto e filtro da IA, progresso de meta, rentabilidade simulada, parcelamentos e, «planejado», saldo das contas (`PedidoCalcularSaldoContas`). Não acessa banco. |
| Pluggy (Open Finance sandbox) | Secundário (externo) | Provedor de Open Finance em sandbox (instituições fictícias). Fornece o widget de conexão, os itens, as contas e as transações importadas (RF09, RF34) e, «planejado», o saldo somente leitura das contas Open Finance (RN3). |
| API de IA generativa | Secundário (externo) | Acessada pelo `genai.client` do Backend. Gera as respostas do chat do Mentor (RF19) e as mensagens proativas (RF20), sempre filtradas depois pelo Servidor Java para não recomendar ativos (RF22). |
| Serviço de e-mail | Secundário (externo) | SMTP usado pelo `emailService`. Envia o e-mail de confirmação do cadastro (`PendingRegistrationModel` / `verifyEmail`) e o de recuperação de senha (RF01, RF03). |

## 2. Diagramas de casos de uso

O diagrama completo ficaria ilegível; por isso ele é dividido em quatro grupos de features. O Usuário do plano Pro herda os casos de uso do Usuário do plano Free em todos os grupos.

### 2.1 Grupo A — Acesso, conta e plano (UC01 a UC07)

```mermaid
flowchart LR
    V(["Visitante"])
    F(["Usuário do plano Free"])
    P(["Usuário do plano Pro"])
    J(["Servidor Java"])
    M(["Serviço de e-mail"])
    P -->|"generalização"| F
    V --- UC01(("UC01 Cadastrar-se"))
    V --- UC02(("UC02 Autenticar-se"))
    V --- UC03(("UC03 Recuperar senha"))
    UC01 -->|"include"| UC01a(("UC01a Confirmar e-mail"))
    UC01 --- J
    UC01 --- M
    UC02 --- J
    UC03 --- M
    UC03 --- J
    F --- UC04(("UC04 Habilitar MFA - futuro"))
    F --- UC05(("UC05 Editar perfil e preferências"))
    F --- UC06(("UC06 Consultar plano e fazer upgrade"))
    F --- UC07(("UC07 Reportar problema"))
    UC04 --- J
```

```plantuml
@startuml
left to right direction
actor "Visitante" as V
actor "Usuário do plano Free" as F
actor "Usuário do plano Pro" as P
actor "Servidor Java" as J <<sistema>>
actor "Serviço de e-mail" as M <<externo>>
P --|> F
rectangle "Acesso, conta e plano" {
  usecase "UC01 Cadastrar-se" as UC01
  usecase "UC01a Confirmar e-mail" as UC01a
  usecase "UC02 Autenticar-se (login e sair)" as UC02
  usecase "UC03 Recuperar senha" as UC03
  usecase "UC04 Habilitar autenticação multifator\n<<futuro>>" as UC04
  usecase "UC05 Editar perfil e preferências" as UC05
  usecase "UC06 Consultar plano e fazer upgrade" as UC06
  usecase "UC07 Reportar problema" as UC07
}
V --> UC01
V --> UC02
V --> UC03
UC01 .> UC01a : <<include>>
UC01 --> J
UC01 --> M
UC02 --> J
UC03 --> M
UC03 --> J
F --> UC04
F --> UC05
F --> UC06
F --> UC07
UC04 --> J
note right of UC04
  <<futuro>> RF04: sem código
  (PedidoGerarSegredoMFA e
  PedidoValidarMFA não existem).
end note
@enduml
```

### 2.2 Grupo B — Transações e contas conectadas Pluggy (UC08 a UC15)

```mermaid
flowchart LR
    F(["Usuário do plano Free"])
    P(["Usuário do plano Pro"])
    J(["Servidor Java"])
    PL(["Pluggy (Open Finance sandbox)"])
    P -->|"generalização"| F
    F --- UC08(("UC08 Lançar receita ou despesa manual"))
    F --- UC09(("UC09 Marcar despesa como recorrente - futuro"))
    F --- UC11(("UC11 Editar e excluir transações"))
    F --- UC12(("UC12 Listar e filtrar transações"))
    F --- UC13(("UC13 Duplicar lançamento"))
    F --- UC14(("UC14 Gerenciar contas conectadas Pluggy"))
    F --- UC15(("UC15 Importar transações da Pluggy"))
    UC08 -->|"include"| UC10(("UC10 Categorizar transação automaticamente"))
    UC15 -->|"include"| UC10
    UC08 -.->|"include - planejado"| UC30(("UC30 Vincular lançamento a uma conta - planejado"))
    UC32(("UC32 Ver e filtrar por conta - planejado")) -->|"extend - planejado"| UC12
    UC10 --- J
    UC14 --- PL
    UC15 --- PL
    UC15 --- J
```

```plantuml
@startuml
left to right direction
actor "Usuário do plano Free" as F
actor "Usuário do plano Pro" as P
actor "Servidor Java" as J <<sistema>>
actor "Pluggy (Open Finance sandbox)" as PL <<externo>>
P --|> F
rectangle "Transações e contas conectadas" {
  usecase "UC08 Lançar receita ou despesa manual" as UC08
  usecase "UC09 Marcar despesa como recorrente\n<<futuro>>" as UC09
  usecase "UC10 Categorizar transação automaticamente" as UC10
  usecase "UC11 Editar e excluir transações\n(individual ou em lote)" as UC11
  usecase "UC12 Listar e filtrar transações" as UC12
  usecase "UC13 Duplicar lançamento" as UC13
  usecase "UC14 Gerenciar contas conectadas (Pluggy)" as UC14
  usecase "UC15 Importar transações da Pluggy" as UC15
  usecase "UC30 Vincular lançamento a uma conta\n<<planejado>>" as UC30
  usecase "UC32 Ver e filtrar lançamentos por conta\n<<planejado>>" as UC32
}
F --> UC08
F --> UC09
F --> UC11
F --> UC12
F --> UC13
F --> UC14
F --> UC15
UC08 .> UC10 : <<include>>
UC15 .> UC10 : <<include>>
UC08 .> UC30 : <<include>> <<planejado>>
UC32 .> UC12 : <<extend>> <<planejado>>
UC10 --> J
UC14 --> PL
UC15 --> PL
UC15 --> J
@enduml
```

### 2.3 Grupo C — Painel, Mentor, metas e cartões (UC16 a UC27)

```mermaid
flowchart LR
    F(["Usuário do plano Free"])
    P(["Usuário do plano Pro"])
    J(["Servidor Java"])
    IA(["API de IA generativa"])
    P -->|"generalização"| F
    F --- UC16(("UC16 Visualizar painel financeiro"))
    F --- UC17(("UC17 Analisar gastos por categoria"))
    F --- UC18(("UC18 Comparar períodos"))
    F --- UC19(("UC19 Consultar resumo do período"))
    F --- UC20(("UC20 Conversar com o Mentor Financeiro"))
    F --- UC21(("UC21 Receber explicação proativa"))
    F --- UC22(("UC22 Consultar e marcar alertas"))
    F --- UC23(("UC23 Gerenciar metas financeiras"))
    F --- UC24(("UC24 Acompanhar progresso da meta"))
    F --- UC25(("UC25 Consultar portfólio simulado - futuro"))
    F --- UC26(("UC26 Gerenciar cartões e consultar fatura"))
    F --- UC27(("UC27 Consultar parcelamentos do cartão"))
    UC16 --- J
    UC18 --- J
    UC20 --- J
    UC20 --- IA
    UC21 --- J
    UC21 --- IA
    UC24 --- J
    UC25 --- J
    UC26 --- J
    UC27 --- J
```

```plantuml
@startuml
left to right direction
actor "Usuário do plano Free" as F
actor "Usuário do plano Pro" as P
actor "Servidor Java" as J <<sistema>>
actor "API de IA generativa" as IA <<externo>>
P --|> F
rectangle "Painel, Mentor, metas e cartões" {
  usecase "UC16 Visualizar painel financeiro" as UC16
  usecase "UC17 Analisar gastos por categoria" as UC17
  usecase "UC18 Comparar períodos" as UC18
  usecase "UC19 Consultar resumo do período" as UC19
  usecase "UC20 Conversar com o Mentor Financeiro" as UC20
  usecase "UC21 Receber explicação proativa" as UC21
  usecase "UC22 Consultar e marcar alertas" as UC22
  usecase "UC23 Gerenciar metas financeiras" as UC23
  usecase "UC24 Acompanhar progresso da meta" as UC24
  usecase "UC25 Consultar portfólio simulado\n<<futuro>>" as UC25
  usecase "UC26 Gerenciar cartões e consultar fatura" as UC26
  usecase "UC27 Consultar parcelamentos do cartão" as UC27
}
F --> UC16
F --> UC17
F --> UC18
F --> UC19
F --> UC20
F --> UC21
F --> UC22
F --> UC23
F --> UC24
F --> UC25
F --> UC26
F --> UC27
UC16 --> J
UC18 --> J
UC20 --> J
UC20 --> IA
UC21 --> J
UC21 --> IA
UC24 --> J
UC25 --> J
UC26 --> J
UC27 --> J
note right of UC25
  <<futuro>> na interface: Backend e Servidor
  prontos (PedidoRentabilidadeSimulada), sem tela.
end note
@enduml
```

### 2.4 Grupo D — Contas e transferências «planejado» (UC28 a UC33)

Todo o grupo é «planejado» (ver `especificacao-contas-e-transferencias.md`).

```mermaid
flowchart LR
    F(["Usuário do plano Free"])
    P(["Usuário do plano Pro"])
    J(["Servidor Java"])
    PL(["Pluggy (Open Finance sandbox)"])
    P -->|"generalização"| F
    F --- UC28(("UC28 Gerenciar contas manuais - planejado"))
    P --- UC29(("UC29 Criar conta Open Finance - planejado"))
    F --- UC31(("UC31 Transferir entre contas - planejado"))
    F --- UC32(("UC32 Ver e filtrar lançamentos por conta - planejado"))
    UC08(("UC08 Lançar receita ou despesa manual")) -->|"include"| UC30(("UC30 Vincular lançamento a uma conta - planejado"))
    UC28 -->|"include"| UC33(("UC33 Calcular saldo das contas - planejado"))
    UC31 -->|"include"| UC33
    UC29 -->|"extend: Free tenta e é levado ao upgrade"| UC06(("UC06 Consultar plano e fazer upgrade"))
    UC29 -->|"include"| UC14(("UC14 Gerenciar contas conectadas Pluggy"))
    UC32 -->|"extend"| UC12(("UC12 Listar e filtrar transações"))
    UC33 --- J
    UC29 --- PL
    UC14 --- PL
```

```plantuml
@startuml
left to right direction
actor "Usuário do plano Free" as F
actor "Usuário do plano Pro" as P
actor "Servidor Java" as J <<sistema>>
actor "Pluggy (Open Finance sandbox)" as PL <<externo>>
P --|> F
rectangle "Contas e transferências <<planejado>>" {
  usecase "UC28 Gerenciar contas manuais\n<<planejado>>" as UC28
  usecase "UC29 Criar conta Open Finance\n<<planejado>>" as UC29
  usecase "UC30 Vincular lançamento a uma conta\n<<planejado>>" as UC30
  usecase "UC31 Transferir entre contas\n<<planejado>>" as UC31
  usecase "UC32 Ver e filtrar lançamentos por conta\n<<planejado>>" as UC32
  usecase "UC33 Calcular saldo das contas\n<<planejado>>" as UC33
}
usecase "UC08 Lançar receita ou despesa manual" as UC08
usecase "UC06 Consultar plano e fazer upgrade" as UC06
usecase "UC12 Listar e filtrar transações" as UC12
usecase "UC14 Gerenciar contas conectadas (Pluggy)" as UC14
F --> UC28
P --> UC29
F --> UC31
F --> UC32
UC08 .> UC30 : <<include>>
UC28 .> UC33 : <<include>>
UC31 .> UC33 : <<include>>
UC29 .> UC14 : <<include>>
UC06 <. UC29 : <<extend>>
UC32 .> UC12 : <<extend>>
UC33 --> J
UC29 --> PL
UC14 --> PL
note bottom of UC29
  Free: opção bloqueada; API responde
  403 PLAN_REQUIRED e leva ao upgrade (UC06).
end note
@enduml
```

> Nota sobre a direção do «extend» de UC29: o plano define que o upgrade (UC06) é o ponto de extensão usado por UC29 quando o Free tenta criar conta Open Finance. Na convenção UML a seta do extend sai do caso que estende; aqui o comportamento extra (convite ao upgrade) é disparado a partir de UC29, e por isso a seta é desenhada de UC29 para UC06 e documentada no fluxo alternativo A1 de UC29.

## 3. Rastreabilidade UC x RF

| UC | RF relacionados | Estado |
|---|---|---|
| UC01, UC01a | RF01, RF30, RNF01 | existente |
| UC02 | RF02, RF30, RNF02 | existente |
| UC03 | RF03 | existente |
| UC04 | RF04 | «futuro» |
| UC05 | RF05, RF28, RF29 | existente |
| UC06 | RF31 | existente |
| UC07 | RF32 | existente |
| UC08 | RF06, RF07 | existente |
| UC09 | RF08 | «futuro» |
| UC10 | RF10, RNF05 | existente |
| UC11 | RF10, RNF06 | existente |
| UC12 | RF12, RNF06 | existente |
| UC13 | RF33 | existente (ação no Frontend pendente) |
| UC14 | RF34 | existente |
| UC15 | RF09, RF10 | existente |
| UC16 | RF13, RF14 | existente |
| UC17 | RF15, RF16, RF35 | existente |
| UC18 | RF17 | existente |
| UC19 | RF18 | existente |
| UC20 | RF19, RF22 | existente |
| UC21 | RF20, RF22 | existente |
| UC22 | RF21 | existente |
| UC23 | RF23 | existente |
| UC24 | RF24 | existente |
| UC25 | RF25, RF26 | «futuro» |
| UC26 | RF27 | existente |
| UC27 | RF36 | existente |
| UC28 | RF37, RF38, RF39 | «planejado» |
| UC29 | RF39, RN3 | «planejado» |
| UC30 | RF40, RN4, RN5 | «planejado» |
| UC31 | RF41, RN6, RN7, RN9 | «planejado» |
| UC32 | RF42 | «planejado» |
| UC33 | RF38, RN2, RN9 | «planejado» |

## 4. Descrições textuais (formato Astah)

Convenção: RN refere-se às regras de negócio da `especificacao-contas-e-transferencias.md`. Os fluxos descrevem o comportamento a partir do plano de modelagem; detalhes de tela e de rota estão em `contrato-api.md`.

### Grupo A — Acesso, conta e plano

#### UC01 — Cadastrar-se

| Campo | Conteúdo |
|---|---|
| ID | UC01 |
| Nome | Cadastrar-se |
| Ator principal | Visitante |
| Atores secundários | Servidor Java; Serviço de e-mail |
| Pré-condições | O visitante não está autenticado e o e-mail e o CPF ainda não pertencem a um usuário. |
| Fluxo principal | 1. O visitante informa nome, e-mail, CPF e senha.<br>2. O Backend valida os dados (`registerSchema`, `validarCPF`).<br>3. O Backend envia `PedidoHashSenha` ao Servidor Java e recebe o hash e o sal.<br>4. O Backend grava o cadastro pendente (`PendingRegistrationModel`).<br>5. O Backend envia o e-mail de confirmação pelo Serviço de e-mail.<br>6. O sistema informa que a confirmação foi enviada. «include» UC01a. |
| Fluxos alternativos | A1. Dados inválidos (campo vazio, CPF inválido, senha fora da regra): o Backend responde 400 e a tela mostra o erro.<br>A2. E-mail ou CPF já cadastrado: o cadastro é recusado com mensagem.<br>A3. Servidor Java indisponível: o Backend responde 503 e o cadastro não é feito.<br>A4. Falha no envio do e-mail: o erro é informado ao visitante. |
| Pós-condições | Existe um cadastro pendente com a senha em hash, aguardando a confirmação do e-mail. |
| Requisitos relacionados | RF01, RF30, RNF01 |

#### UC01a — Confirmar e-mail

| Campo | Conteúdo |
|---|---|
| ID | UC01a (incluído por UC01) |
| Nome | Confirmar e-mail |
| Ator principal | Visitante |
| Atores secundários | Serviço de e-mail |
| Pré-condições | Existe um cadastro pendente e o visitante recebeu o link de confirmação. |
| Fluxo principal | 1. O visitante abre o link recebido por e-mail.<br>2. O Backend executa `verifyEmail`, localiza o cadastro pendente e cria o `UserModel`.<br>3. O cadastro pendente é removido.<br>4. A tela informa que a conta está ativa e leva ao login. |
| Fluxos alternativos | A1. Link inválido ou expirado: o Backend recusa e a tela informa o problema. |
| Pós-condições | O usuário existe com plano `free` e pode fazer login. |
| Requisitos relacionados | RF01 |

#### UC02 — Autenticar-se (login e sair)

| Campo | Conteúdo |
|---|---|
| ID | UC02 |
| Nome | Autenticar-se (login e sair) |
| Ator principal | Visitante |
| Atores secundários | Servidor Java |
| Pré-condições | O usuário já confirmou o e-mail (UC01a). |
| Fluxo principal | 1. O visitante informa e-mail e senha.<br>2. O Backend busca o usuário pelo e-mail.<br>3. O Backend envia `PedidoValidarSenha` ao Servidor Java.<br>4. Com `valido = true`, o Backend gera o JWT e devolve `{token, usuario}`.<br>5. O Frontend guarda a sessão no storage e abre o painel.<br>6. Em toda rota privada o `authMiddleware` valida o JWT.<br>7. Para sair, o Frontend apaga a sessão do storage. |
| Fluxos alternativos | A1. Dados inválidos: 400 `VALIDATION_ERROR`.<br>A2. E-mail inexistente ou senha incorreta: 401 `INVALID_CREDENTIALS`.<br>A3. Servidor Java fora do ar: 503 `JAVA_SERVER_UNAVAILABLE`.<br>A4. Token ausente ou inválido em rota privada: 401 `UNAUTHENTICATED`. |
| Pós-condições | Com sucesso, o usuário tem sessão válida; ao sair, a sessão local é apagada. |
| Requisitos relacionados | RF02, RF30, RNF02 |

#### UC03 — Recuperar senha

| Campo | Conteúdo |
|---|---|
| ID | UC03 |
| Nome | Recuperar senha |
| Ator principal | Visitante |
| Atores secundários | Serviço de e-mail; Servidor Java |
| Pré-condições | O e-mail informado pertence a um usuário cadastrado. |
| Fluxo principal | 1. O visitante pede a recuperação (`forgotPassword`) informando o e-mail.<br>2. O Backend envia o link de redefinição pelo Serviço de e-mail.<br>3. O visitante abre o link e informa a nova senha (`resetPassword`).<br>4. O Backend pede o hash ao Servidor Java e grava a nova senha.<br>5. A tela leva ao login. |
| Fluxos alternativos | A1. Link inválido ou expirado: a redefinição é recusada.<br>A2. Senha fora da regra: 400 e a tela mostra o erro.<br>A3. Servidor Java indisponível: 503. |
| Pós-condições | A senha do usuário é substituída pelo novo hash. |
| Requisitos relacionados | RF03 |

#### UC04 — Habilitar autenticação multifator «futuro»

| Campo | Conteúdo |
|---|---|
| ID | UC04 |
| Nome | Habilitar autenticação multifator |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Usuário autenticado. Feature futura: não há código (só a pasta `mfa` com exemplo; `PedidoGerarSegredoMFA` e `PedidoValidarMFA` não existem). |
| Fluxo principal | 1. O usuário pede para habilitar o MFA.<br>2. O sistema gera o segredo (previsto no Servidor Java) e o exibe.<br>3. O usuário confirma com um código.<br>4. O sistema marca `mfaEnabled` no usuário. |
| Fluxos alternativos | A1. Código incorreto: a habilitação não é concluída. |
| Pós-condições | Previstas: `mfaEnabled` verdadeiro e login em duas etapas. |
| Requisitos relacionados | RF04 |

#### UC05 — Editar perfil e preferências

| Campo | Conteúdo |
|---|---|
| ID | UC05 |
| Nome | Editar perfil e preferências |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre o Perfil.<br>2. Altera os dados do perfil; o Backend valida com `atualizarPerfilSchema` e grava.<br>3. Altera as preferências locais: tema claro/escuro (`theme`) e ocultar valores sensíveis (`valores` / `preferencias`).<br>4. O Frontend aplica as preferências imediatamente. |
| Fluxos alternativos | A1. Dados inválidos: 400 e a tela mostra o erro. |
| Pós-condições | Perfil atualizado e preferências aplicadas. |
| Requisitos relacionados | RF05, RF28, RF29 |

#### UC06 — Consultar plano e fazer upgrade

| Campo | Conteúdo |
|---|---|
| ID | UC06 |
| Nome | Consultar plano e fazer upgrade |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre a tela PlanoConta e vê o plano atual (Free ou Pro).<br>2. Escolhe trocar de plano.<br>3. O Frontend chama `authService.atualizarPlano` e o Backend grava o novo plano.<br>4. A tela mostra o plano atualizado. |
| Fluxos alternativos | A1. Falha na troca: a tela mostra o erro e o plano não muda.<br>A2. Ponto de extensão: UC29 leva a este caso de uso quando o Free tenta criar conta Open Finance «planejado». |
| Pós-condições | O plano do usuário (`UserModel.plano`) reflete a escolha. |
| Requisitos relacionados | RF31 |

#### UC07 — Reportar problema

| Campo | Conteúdo |
|---|---|
| ID | UC07 |
| Nome | Reportar problema |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre ReportarProblema e descreve o problema.<br>2. O Frontend envia `POST /v1/suporte`.<br>3. O Backend valida (`criarSuporteSchema`) e grava na coleção de suporte.<br>4. A tela confirma o envio. |
| Fluxos alternativos | A1. Dados inválidos: 400 e a tela mostra o erro. |
| Pós-condições | O relato fica registrado na coleção de suporte. |
| Requisitos relacionados | RF32 |

### Grupo B — Transações e contas conectadas

#### UC08 — Lançar receita ou despesa manual

| Campo | Conteúdo |
|---|---|
| ID | UC08 |
| Nome | Lançar receita ou despesa manual |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java (via UC10) |
| Pré-condições | Usuário autenticado. «planejado»: ter pelo menos uma conta (UC30, RN4). |
| Fluxo principal | 1. O usuário abre Lançamento e escolhe Nova receita ou Nova despesa.<br>2. Receita: informa descrição, valor, data e categoria. Despesa: acrescenta forma de pagamento, observações, meta, cartão e parcelas.<br>3. O formulário valida no cliente (`formValidation`).<br>4. O Frontend envia `POST /v1/transactions`; o Backend valida (`createTransactionSchema`).<br>5. Se a categoria está em branco, «include» UC10.<br>6. Para crédito parcelado, o Backend monta as parcelas e o vínculo com o cartão.<br>7. O Backend grava e responde 201; a lista e o resumo são atualizados e uma notificação é exibida.<br>8. «planejado»: «include» UC30 exige a conta (`contaId`). |
| Fluxos alternativos | A1. Dados inválidos: 400 `VALIDATION_ERROR`.<br>A2. Token inválido: 401 `UNAUTHENTICATED`.<br>A3. Servidor Java indisponível na categorização: a categoria fica "Outros" (RNF05).<br>A4. «planejado»: sem nenhuma conta, o botão Lançamento leva a UC28 e a API responde 422 `ACCOUNT_REQUIRED`. |
| Pós-condições | A transação existe no MongoDB com origem `manual` e aparece na lista. |
| Requisitos relacionados | RF06, RF07 |

#### UC09 — Marcar despesa como recorrente «futuro»

| Campo | Conteúdo |
|---|---|
| ID | UC09 |
| Nome | Marcar despesa como recorrente |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. Feature futura: sem issue nem código. |
| Fluxo principal | 1. O usuário marca uma despesa como recorrente (fixa mensal).<br>2. O sistema guarda a recorrência (previsto). |
| Fluxos alternativos | Não definidos (feature futura). |
| Pós-condições | Previstas: a despesa fica marcada como recorrente. |
| Requisitos relacionados | RF08 |

#### UC10 — Categorizar transação automaticamente

| Campo | Conteúdo |
|---|---|
| ID | UC10 (incluído por UC08, UC15 e pela sugestão de categoria) |
| Nome | Categorizar transação automaticamente |
| Ator principal | Servidor Java |
| Atores secundários | — |
| Pré-condições | Existe uma transação (ou descrição) sem categoria: lançamento manual sem categoria, transação importada ou chamada a `POST /transactions/suggest-category`. |
| Fluxo principal | 1. O Backend envia `PedidoCategorizarTransacao` ao Servidor Java.<br>2. O `TransactionsHandler` categoriza por palavras-chave.<br>3. O Servidor devolve `RespostaCategorizarTransacao` com a categoria.<br>4. O Backend usa a categoria na transação. |
| Fluxos alternativos | A1. Servidor Java fora do ar ou com falha: a categoria fica "Outros" (RNF05). |
| Pós-condições | A transação tem categoria definida. |
| Requisitos relacionados | RF10, RNF05 |

#### UC11 — Editar e excluir transações (individual ou em lote)

| Campo | Conteúdo |
|---|---|
| ID | UC11 |
| Nome | Editar e excluir transações (individual ou em lote) |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado e transação existente (manual ou importada). |
| Fluxo principal | 1. O usuário edita um campo, inclusive na própria célula (`EdicaoCelula`), ou abre o detalhe e altera os campos.<br>2. O Backend valida (`updateTransactionSchema`) e grava.<br>3. Para excluir, o usuário confirma e o Backend remove.<br>4. Em lote, o usuário seleciona até 100 itens e aplica a edição ou a exclusão (`bulkUpdateSchema`, `bulkDeleteSchema`).<br>5. A lista é atualizada. |
| Fluxos alternativos | A1. Lote com mais de 100 itens: 400.<br>A2. Transação inexistente ou de outro usuário: erro de não encontrada.<br>A3. Dados inválidos: 400. |
| Pós-condições | As transações ficam alteradas ou removidas. |
| Requisitos relacionados | RF10, RNF06 |

#### UC12 — Listar e filtrar transações

| Campo | Conteúdo |
|---|---|
| ID | UC12 |
| Nome | Listar e filtrar transações |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre Transações.<br>2. O Frontend chama `GET /v1/transactions` com paginação.<br>3. O usuário aplica filtros por descrição, categoria, período, faixa de valor, forma de pagamento, meta e origem, abertos no cabeçalho das colunas (a faixa de filtros saiu).<br>4. A lista mostra as transações e os totais (receitas, despesas e saldo) em um cartão com fundo escuro. |
| Fluxos alternativos | A1. Nenhum resultado: a lista mostra o estado vazio.<br>A2. Filtro inválido: 400. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF12, RNF06 |

#### UC13 — Duplicar lançamento

| Campo | Conteúdo |
|---|---|
| ID | UC13 |
| Nome | Duplicar lançamento |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Existe um lançamento do usuário. O Backend está pronto; a ação no Frontend é pendente segundo o documento de visão. |
| Fluxo principal | 1. O usuário escolhe duplicar um lançamento.<br>2. O Frontend envia `POST /transactions/:id/duplicate` (`duplicateTransactionSchema`).<br>3. O Backend cria uma cópia e responde com ela.<br>4. A lista é atualizada. |
| Fluxos alternativos | A1. Lançamento inexistente: erro de não encontrado.<br>A2. Dados inválidos: 400. |
| Pós-condições | Existe uma nova transação copiada da original. |
| Requisitos relacionados | RF33 |

#### UC14 — Gerenciar contas conectadas (Pluggy)

| Campo | Conteúdo |
|---|---|
| ID | UC14 |
| Nome | Gerenciar contas conectadas (Pluggy) |
| Ator principal | Usuário do plano Free |
| Atores secundários | Pluggy (Open Finance sandbox) |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre Contas Conectadas e vê a lista.<br>2. Para conectar, abre o widget `pluggyConnect`, escolhe a instituição fictícia e conclui.<br>3. O Backend grava a conta conectada (`connected_accounts`).<br>4. Para desconectar, o usuário confirma e o Backend remove a conexão. «planejado»: passa a ser o fluxo de UC29 e fica restrito ao plano Pro para contas novas. |
| Fluxos alternativos | A1. Falha na Pluggy: a tela mostra o erro (`erros`).<br>A2. Usuário cancela o widget: nada é gravado. |
| Pós-condições | A lista de contas conectadas reflete a conexão ou a desconexão. |
| Requisitos relacionados | RF34 |

#### UC15 — Importar transações da Pluggy

| Campo | Conteúdo |
|---|---|
| ID | UC15 |
| Nome | Importar transações da Pluggy |
| Ator principal | Usuário do plano Free |
| Atores secundários | Pluggy (Open Finance sandbox); Servidor Java |
| Pré-condições | Existe uma conta conectada (UC14). |
| Fluxo principal | 1. O usuário aciona a sincronização da conta conectada.<br>2. O Backend lê as transações pela Pluggy.<br>3. O `pluggy.mapper` gera `TransacaoParaImportar` e ignora as inválidas.<br>4. «include» UC10 categoriza as importadas.<br>5. O Backend grava as transações com origem `pluggy` e devolve o `ResultadoImportacao`. |
| Fluxos alternativos | A1. Transação inválida: ignorada e contada no resultado.<br>A2. Pluggy indisponível: erro ao usuário.<br>A3. Servidor Java fora do ar: categoria "Outros". |
| Pós-condições | As transações importadas ficam na lista, com origem `pluggy`. |
| Requisitos relacionados | RF09, RF10 |

### Grupo C — Painel, Mentor, metas e cartões

#### UC16 — Visualizar painel financeiro

| Campo | Conteúdo |
|---|---|
| ID | UC16 |
| Nome | Visualizar painel financeiro |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre a tela inicial.<br>2. O Backend lê as transações e envia `PedidoCalcularIndicadores` ao Servidor Java.<br>3. O painel mostra saldo em contas, gastos do mês, economia acumulada, fluxo de caixa e as transações recentes. «planejado»: transferências ficam fora dos totais (RN6, issue #107). |
| Fluxos alternativos | A1. Servidor Java indisponível: 503 e o painel mostra o erro.<br>A2. Sem transações: o painel mostra valores zerados. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF13, RF14 |

#### UC17 — Analisar gastos por categoria

| Campo | Conteúdo |
|---|---|
| ID | UC17 |
| Nome | Analisar gastos por categoria |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário escolhe um período.<br>2. O sistema mostra a distribuição dos gastos por categoria e por grupo de categorias.<br>3. O usuário expande uma categoria para ver as transações que a compõem. |
| Fluxos alternativos | A1. Sem gastos no período: estado vazio. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF15, RF16, RF35 |

#### UC18 — Comparar períodos

| Campo | Conteúdo |
|---|---|
| ID | UC18 |
| Nome | Comparar períodos |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário escolhe o tipo de comparação (mensal, últimos 6 meses ou YTD, `TipoPeriodoComparacao`).<br>2. O Backend envia `PedidoCompararPeriodos` ao Servidor Java.<br>3. A tela mostra receitas e despesas comparadas entre os períodos. |
| Fluxos alternativos | A1. Servidor Java indisponível: 503. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF17 |

#### UC19 — Consultar resumo do período

| Campo | Conteúdo |
|---|---|
| ID | UC19 |
| Nome | Consultar resumo do período |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário seleciona o período.<br>2. O sistema mostra total gasto, categoria de maior peso, número de transações e média diária (`TransactionSummaryDto` / `DashboardSummaryDto`). «planejado»: ignora transferências. |
| Fluxos alternativos | A1. Sem transações no período: valores zerados. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF18 |

#### UC20 — Conversar com o Mentor Financeiro

| Campo | Conteúdo |
|---|---|
| ID | UC20 |
| Nome | Conversar com o Mentor Financeiro |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java; API de IA generativa |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário digita a pergunta.<br>2. O Backend grava a mensagem (`ChatMessageModel`) e monta o resumo das transações e o histórico.<br>3. Envia `PedidoMontarContextoIA` ao Servidor Java.<br>4. Chama a API de IA generativa com contexto, histórico e pergunta.<br>5. Envia `PedidoFiltrarResposta` ao Servidor Java (`FiltroDeAtivos`, `FiltroDeEscopo`).<br>6. Grava a resposta e a exibe com markdown.<br>7. O usuário também pode consultar o histórico da conversa. |
| Fluxos alternativos | A1. Erro ou indisponibilidade da IA: 503.<br>A2. Resposta com recomendação de ativos: o filtro a descarta ou ajusta (RF22).<br>A3. Servidor Java indisponível: 503. |
| Pós-condições | Pergunta e resposta ficam no histórico. |
| Requisitos relacionados | RF19, RF22 |

#### UC21 — Receber explicação proativa

| Campo | Conteúdo |
|---|---|
| ID | UC21 |
| Nome | Receber explicação proativa |
| Ator principal | Usuário do plano Free |
| Atores secundários | API de IA generativa; Servidor Java |
| Pré-condições | Usuário autenticado com histórico de transações. |
| Fluxo principal | 1. O usuário abre o Mentor.<br>2. O Backend gera a mensagem proativa (`proactiveMessage`) sobre padrões do histórico, usando a IA.<br>3. A resposta passa pelo mesmo filtro de ativos do Servidor Java.<br>4. A mensagem é exibida. |
| Fluxos alternativos | A1. IA ou Servidor Java indisponível: erro 503.<br>A2. Sem histórico suficiente: não há padrão a explicar. |
| Pós-condições | Mensagem proativa exibida. |
| Requisitos relacionados | RF20, RF22 |

#### UC22 — Consultar e marcar alertas

| Campo | Conteúdo |
|---|---|
| ID | UC22 |
| Nome | Consultar e marcar alertas |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre os alertas do Mentor.<br>2. O sistema lista os alertas gerados pelas regras (`alertas.regras`): gasto fora do padrão, fatura próxima e dinheiro parado.<br>3. O usuário marca um alerta como lido. |
| Fluxos alternativos | A1. Sem alertas: estado vazio.<br>A2. Alerta inexistente: erro de não encontrado. |
| Pós-condições | O alerta fica marcado como lido. |
| Requisitos relacionados | RF21 |

#### UC23 — Gerenciar metas financeiras

| Campo | Conteúdo |
|---|---|
| ID | UC23 |
| Nome | Gerenciar metas financeiras |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre Metas.<br>2. Cria uma meta com nome, valor desejado e prazo, ou edita ou exclui uma existente.<br>3. O Backend valida e grava (`GoalModel`).<br>4. As transações se vinculam à meta pela `metaId`. |
| Fluxos alternativos | A1. Dados inválidos: 400. |
| Pós-condições | A lista de metas reflete a alteração. |
| Requisitos relacionados | RF23 |

#### UC24 — Acompanhar progresso da meta

| Campo | Conteúdo |
|---|---|
| ID | UC24 |
| Nome | Acompanhar progresso da meta |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Existe pelo menos uma meta. |
| Fluxo principal | 1. O usuário abre Metas.<br>2. O Backend soma os aportes (transações com `metaId`) e envia `PedidoProgressoMeta` ao Servidor Java.<br>3. A tela mostra o progresso de cada meta. |
| Fluxos alternativos | A1. Servidor Java indisponível: 503.<br>A2. Meta sem aportes: progresso zero. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF24 |

#### UC25 — Consultar portfólio simulado «futuro»

| Campo | Conteúdo |
|---|---|
| ID | UC25 |
| Nome | Consultar portfólio simulado |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Usuário autenticado. Feature futura na interface: Backend e Servidor Java prontos, sem tela. |
| Fluxo principal | 1. O usuário abre o portfólio.<br>2. O Backend lê os ativos e envia `PedidoRentabilidadeSimulada` ao Servidor Java.<br>3. A tela mostra o patrimônio total e os ativos com rentabilidade (previsto). |
| Fluxos alternativos | A1. Servidor Java indisponível: 503. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF25, RF26 |

#### UC26 — Gerenciar cartões e consultar fatura

| Campo | Conteúdo |
|---|---|
| ID | UC26 |
| Nome | Gerenciar cartões e consultar fatura |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre Cartões.<br>2. Cadastra um cartão simulado (até 5) ou edita e exclui um existente.<br>3. O Backend lê as compras de cada cartão e calcula os parcelamentos pelo Servidor Java (UC27).<br>4. A tela mostra fatura do mês, vencimento e limite disponível.<br>5. Ao abrir um cartão, `CartaoCompras` lista as compras do cartão. |
| Fluxos alternativos | A1. Já existem 5 cartões: o cadastro é recusado.<br>A2. Servidor Java indisponível: 503 e a tela mostra o erro. |
| Pós-condições | Cartões atualizados e fatura exibida. |
| Requisitos relacionados | RF27 |

#### UC27 — Consultar parcelamentos do cartão

| Campo | Conteúdo |
|---|---|
| ID | UC27 |
| Nome | Consultar parcelamentos do cartão |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Existem compras parceladas no crédito (nascem em UC08). O cadastro manual de parcelamento é feature futura. |
| Fluxo principal | 1. O Backend monta os parcelamentos de cada cartão.<br>2. Envia `PedidoCalcularParcelamentos` ao Servidor Java.<br>3. Recebe parcela atual, valor da parcela, juros e saldo devedor.<br>4. A tela exibe os dados. |
| Fluxos alternativos | A1. Servidor Java indisponível: 503. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF36 |

### Grupo D — Contas e transferências «planejado»

#### UC28 — Gerenciar contas manuais «planejado»

| Campo | Conteúdo |
|---|---|
| ID | UC28 |
| Nome | Gerenciar contas manuais |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Usuário autenticado. |
| Fluxo principal | 1. O usuário abre Contas Conectadas e clica em Nova conta.<br>2. Na janela (modal), informa nome (1 a 40 caracteres, único por usuário), banco (lista fixa) e saldo inicial, com tipo manual.<br>3. O Backend grava a conta (`POST /v1/accounts`).<br>4. O Backend calcula o saldo atual de cada conta: «include» UC33.<br>5. A lista mostra as contas, cada uma com saldo atual.<br>6. O usuário pode editar nome, banco e saldo inicial (`PATCH`) ou excluir a conta (`DELETE`). O usuário pode ter várias contas. |
| Fluxos alternativos | A1. Nome já usado (sem diferenciar maiúsculas): 409 `ACCOUNT_NAME_IN_USE`.<br>A2. Excluir conta com lançamentos: 409 `ACCOUNT_HAS_TRANSACTIONS` (RN8).<br>A3. Conta inexistente: 404 `ACCOUNT_NOT_FOUND`.<br>A4. Dados inválidos: 400. |
| Pós-condições | A conta criada, editada ou excluída é refletida na lista com o saldo atual calculado. |
| Requisitos relacionados | RF37, RF38, RF39 |

#### UC29 — Criar conta Open Finance «planejado»

| Campo | Conteúdo |
|---|---|
| ID | UC29 |
| Nome | Criar conta Open Finance |
| Ator principal | Usuário do plano Pro |
| Atores secundários | Pluggy (Open Finance sandbox) |
| Pré-condições | Usuário autenticado com plano Pro (RN3). |
| Fluxo principal | 1. Na mesma janela de UC28, o usuário escolhe o tipo `open_finance` (com selo PRO).<br>2. O sistema conecta pela Pluggy, reaproveitando UC14.<br>3. O Backend grava a conta com tipo `open_finance` e a ligação à conta conectada (`conectadaId`).<br>4. O saldo vem da Pluggy e é somente leitura. |
| Fluxos alternativos | A1. Plano Free: a opção aparece bloqueada com o selo PRO; se a API for chamada, responde 403 `PLAN_REQUIRED` e a tela convida ao upgrade («extend» UC06).<br>A2. Falha na Pluggy: a tela mostra o erro e a conta não é criada. |
| Pós-condições | Existe uma conta Open Finance com saldo somente leitura. |
| Requisitos relacionados | RF39, RN3 |

#### UC30 — Vincular lançamento a uma conta «planejado»

| Campo | Conteúdo |
|---|---|
| ID | UC30 (incluído por UC08) |
| Nome | Vincular lançamento a uma conta |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado e lançamento manual em criação. |
| Fluxo principal | 1. O formulário de lançamento exibe o campo Conta, obrigatório.<br>2. O usuário escolhe a conta.<br>3. O Backend confirma que `contaId` pertence ao usuário e grava o lançamento com `contaId`.<br>4. Lançamentos importados da Pluggy ficam ligados à conta Open Finance de origem (RN5). |
| Fluxos alternativos | A1. Usuário sem nenhuma conta: o botão Lançamento leva a UC28 e a API responde 422 `ACCOUNT_REQUIRED` (RN4).<br>A2. Conta de outro usuário ou inexistente: 404 `ACCOUNT_NOT_FOUND`. |
| Pós-condições | O lançamento fica vinculado a uma conta do usuário. |
| Requisitos relacionados | RF40, RN4, RN5 |

#### UC31 — Transferir entre contas «planejado»

| Campo | Conteúdo |
|---|---|
| ID | UC31 |
| Nome | Transferir entre contas |
| Ator principal | Usuário do plano Free |
| Atores secundários | Servidor Java |
| Pré-condições | Usuário autenticado com pelo menos duas contas manuais. |
| Fluxo principal | 1. O usuário escolhe Lançamento > Nova transferência (ao lado de despesa e receita) ou o atalho T.<br>2. Informa conta de origem, conta de destino, valor, data, descrição e observação.<br>3. O Frontend envia `POST /v1/transactions/transfers`.<br>4. O Backend valida: contas diferentes e valor maior que zero.<br>5. Confirma que as duas contas pertencem ao usuário e são manuais.<br>6. Grava um único registro do tipo `transferencia` com `contaId` e `contaDestinoId`.<br>7. «include» UC33 recalcula os saldos das duas contas.<br>8. A lista mostra o tipo Transferência e a coluna Origem com a conta; a transferência não entra nos totais do painel (RN6). |
| Fluxos alternativos | A1. Menos de duas contas manuais: a tela leva a Contas Conectadas > Nova conta (UC28).<br>A2. Contas iguais ou valor não positivo: 400.<br>A3. Conta inexistente: 404 `ACCOUNT_NOT_FOUND`.<br>A4. Alguma conta é Open Finance: 422 `TRANSFER_NOT_ALLOWED` (RN7). |
| Pós-condições | A transferência fica registrada e os saldos das duas contas refletem o movimento. |
| Requisitos relacionados | RF41, RN6, RN7, RN9 |

#### UC32 — Ver e filtrar lançamentos por conta «planejado»

| Campo | Conteúdo |
|---|---|
| ID | UC32 (estende UC12) |
| Nome | Ver e filtrar lançamentos por conta |
| Ator principal | Usuário do plano Free |
| Atores secundários | — |
| Pré-condições | Usuário autenticado e lançamentos vinculados a contas. |
| Fluxo principal | 1. Na lista de transações (UC12), a coluna Origem mostra a conta (banco e nome).<br>2. O filtro Origem lista as contas do usuário e filtra por `contaId`.<br>3. O tipo Transferência aparece na coluna Tipo. |
| Fluxos alternativos | A1. Conta sem lançamentos: a lista mostra o estado vazio. |
| Pós-condições | Nenhuma alteração de dados. |
| Requisitos relacionados | RF42 |

#### UC33 — Calcular saldo das contas «planejado»

| Campo | Conteúdo |
|---|---|
| ID | UC33 (incluído por UC28 e UC31) |
| Nome | Calcular saldo das contas |
| Ator principal | Servidor Java |
| Atores secundários | — |
| Pré-condições | O Backend tem as contas (com `saldoInicial`) e os movimentos (receitas, despesas e transferências). |
| Fluxo principal | 1. O Backend envia `PedidoCalcularSaldoContas` com contas e movimentos.<br>2. O `TransactionsHandler.calcularSaldoContas` calcula o saldo atual de cada conta: saldo inicial mais receitas, menos despesas e mais ou menos transferências (RN2).<br>3. O Servidor devolve `RespostaCalcularSaldoContas` com os saldos.<br>4. O Backend inclui `saldoAtual` na resposta das contas. |
| Fluxos alternativos | A1. Servidor Java indisponível: 503 `JAVA_SERVER_UNAVAILABLE`. |
| Pós-condições | Os saldos são calculados e nunca gravados (RN9). |
| Requisitos relacionados | RF38, RN2, RN9 |
