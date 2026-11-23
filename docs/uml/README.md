# Modelagem UML do FinanceAI

Índice da modelagem do FinanceAI em padrão Astah / UML 2. Os diagramas de classes são só do **Servidor Java** (o Backend e o Frontend não têm diagrama de classes). O pedido original cita a pasta "doc"; a pasta real do repositório é `docs/`, então tudo fica em `docs/uml`.

Elementos marcados com «futuro» são funcionalidades previstas sem código ou sem interface (RF04 MFA, RF08 recorrência, RF25/RF26 portfólio na interface).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| [01-arquitetura.md](01-arquitetura.md) | Arquitetura em quatro camadas (Frontend, Backend, Servidor Java, MongoDB Atlas): componentes, implantação e fluxo de uma requisição com o pool de conexões. |
| [02-estrutura-do-servidor.md](02-estrutura-do-servidor.md) | Estrutura do Servidor Java: pacotes `com.financeai.*`, núcleo (Aceitadora, Supervisora, Parceiro, HandlerRegistry) e padrão dos handlers. |
| [03-casos-de-uso.md](03-casos-de-uso.md) | Atores, casos de uso (UC01 a UC33), generalização Usuário Pro -> Free e rastreabilidade UC x requisitos. |
| [04-diagrama-de-classes-servidor.md](04-diagrama-de-classes-servidor.md) | Diagramas de classes do Servidor Java (núcleo, registro dos handlers e mensagens por grupo). |
| [07-diagramas-de-sequencia.md](07-diagramas-de-sequencia.md) | Sequências: login, criação de transação com categorização, chat do Mentor, fatura do cartão e transferência entre contas. |
| [classes/](classes/) | Modelo UML detalhado do Servidor (atributos, operações, interfaces), um arquivo por pacote, listados abaixo. |

### Pasta `classes/`

Servidor Java

| Arquivo | Conteúdo |
|---|---|
| [classes/srv-core.md](classes/srv-core.md) | Main, Aceitadora, Supervisora, Parceiro, Comunicado, Handler, HandlerRegistry, ErroDeNegocio, EcoHandler, Teclado. |
| [classes/srv-auth.md](classes/srv-auth.md) | AuthHandler e mensagens de hash e validação de senha. |
| [classes/srv-transactions.md](classes/srv-transactions.md) | TransactionsHandler, categorização e, cálculo de saldo das contas. |
| [classes/srv-dashboard.md](classes/srv-dashboard.md) | DashboardHandler: indicadores e comparação de períodos. |
| [classes/srv-goals.md](classes/srv-goals.md) | GoalsHandler: progresso de meta. |
| [classes/srv-investments.md](classes/srv-investments.md) | InvestmentsHandler: rentabilidade simulada e parcelamentos. |
| [classes/srv-mentoria.md](classes/srv-mentoria.md) | MentorHandler, FiltroDeAtivos, FiltroDeEscopo e mensagens de contexto e filtro da IA. |

## Como usar os diagramas

Cada diagrama aparece em dois blocos de código com a mesma informação:

1. Bloco `mermaid`: renderiza direto no GitHub (e na maioria dos visualizadores Markdown). Serve para leitura.
2. Bloco `plantuml` (`@startuml ... @enduml`): descreve o mesmo diagrama em sintaxe UML textual. Serve para recriar o modelo no Astah (importando o texto PlantUML, quando o plugin estiver disponível, ou desenhando a partir dele) e para gerar imagens com qualquer renderizador PlantUML.

Observações:

- O Mermaid não possui diagrama de casos de uso. Em `03-casos-de-uso.md` eles aparecem como `flowchart LR` no bloco Mermaid; o bloco PlantUML usa `actor`, `usecase` e `rectangle` e é o fiel ao padrão UML.
- Diagramas de componentes e de implantação em Mermaid também usam `flowchart`.
- O Mermaid não aceita as aspas angulares `«` `»` dentro dos blocos. Nos blocos, os estereótipos são escritos entre `<<` e `>>`; no texto Markdown aparecem entre «».
- Nomes com ponto (`alertas.regras`, `mongo.connection`, `genai.client`, `error-codes`, `pluggy.mapper`) usam identificador com sublinhado no código do diagrama (`alertas_regras`) e rótulo com o nome real. No PlantUML: `class "alertas.regras" as alertas_regras <<module>>`.
- `Comunicado` e `Parceiro` existem em Java e em TypeScript; algumas mensagens (por exemplo `PedidoCalcularParcelamentos`) existem como classe Java e como interface TS. São distinguidos pelo pacote (`srv::core::Comunicado` e `be::java_client::Comunicado`) e nunca aparecem juntos sem o pacote.
- Para recriar no Astah: crie um pacote por subpacote Java (`com.financeai.*`) ou por módulo, copie classes, atributos, operações, estereótipos e relações do bloco PlantUML, e use generalização de atores (Usuário Pro -> Usuário Free) nos casos de uso.

## Legenda da notação

### Visibilidade

| Símbolo | Significado |
|---|---|
| `+` | público (em TS/JS: membro exportado) |
| `-` | privado (em TS/JS: `private` ou função não exportada) |
| `#` | protegido |
| `~` | pacote |

Atributo: `- nome: Tipo`. Operação: `+ nome(param: Tipo): Retorno`. Membros estáticos aparecem sublinhados no Astah (`{static}` no PlantUML).

### Estereótipos

| Estereótipo | Uso |
|---|---|
| «interface» | Interface Java, `interface`/`type` TS |
| «enumeration» | Enumeração ou união literal |
| «service» | Camada de regra do Backend |
| «controller» | Camada HTTP do Backend (valida com zod) |
| «repository» | Acesso ao MongoDB |
| «router» | Rotas Express do módulo |
| «document» | Model Mongoose (coleção) |
| «schema» | Schema zod de validação |
| «dto» | Objeto de transferência (DTOs TS e mensagens Pedido/Resposta do Servidor Java) |
| «handler» | Handler de grupo do Servidor Java |
| «module» | Módulo TS/JS sem classe (objeto exportado ou arquivo de funções) |
| «futuro» | Funcionalidade prevista sem código ou sem interface (RF04, RF08, RF25, RF26) |

### Relações

| Relação | Mermaid | PlantUML | Significado |
|---|---|---|---|
| Generalização | `A <\|-- B` | `A <\|-- B` | B herda de A (`extends`) |
| Realização | `A <\|.. B` | `A <\|.. B` | B implementa a interface A |
| Associação | `A --> B` | `A --> B` | A conhece/usa B de forma durável |
| Agregação | `A o-- B` | `A o-- B` | A agrega B; B existe sem A |
| Composição | `A *-- B` | `A *-- B` | B só existe dentro de A |
| Dependência | `A ..> B` | `A ..> B` | A usa B de forma pontual |

### Multiplicidade

`1` exatamente um, `0..1` zero ou um, `*` zero ou mais, `1..*` um ou mais. Aparece entre aspas junto das pontas da relação, por exemplo `A "1" --> "*" B`.

## Divergências entre documentação e código

Pontos em que a documentação existente e o código não coincidem. Os diagramas seguem o código.

1. `organizacao-sprints.md` chama a thread de "Aceitador"; a classe é `Aceitadora`.
2. `PedidoGerarSegredoMFA`, `PedidoValidarMFA` e `auth/mfa/*.ts` são citados na documentação, mas não existem (só a pasta `mfa/exemplo`). RF04 é «futuro».
3. A documentação diz que cada `PedidoXxx`/`RespostaXxx` "estende Comunicado"; no código são POJOs com constante `TIPO`, carregados por `Comunicado.dadosComo`. Modelados como dependência, não generalização.
4. Os handlers dos grupos não implementam `Handler`; registram métodos privados por method reference em `registrarEm`. Modelado com dependência «registra» e nota.
5. O comentário em `HandlerRegistry.criarPadrao` chama `AuthHandler` de "handler de teste da Sprint 0"; o de teste é `EcoHandler`.
6. `Teclado` (core) não aparece na árvore de pastas do documento.
7. A árvore do Backend em `organizacao-sprints.md` omite `modules/connected-accounts`, `modules/suporte` e `integrations/pluggy`; o módulo dashboard não tem `dashboard.model.ts` (só `dashboard.model.md`), pois o repository lê a coleção `transactions`.
8. A árvore do Frontend no documento não corresponde à real: existem `app/`, `core/` (http, layout, session, theme, views, privacy), `shared/` e as features `Perfil` (com P maiúsculo) e `contas-conectadas`.
9. `/v1/auth` e `/v1/dashboard` já estão documentados no contrato (seções 10 e 11); os diagramas saem do código.
10. Portas: Servidor Java na 3000 (`PORTA_PADRAO "3000"`, `JAVA_SERVER_PORT=3000`, só loopback) e Backend na 3001.
11. `Parceiro` herdou nomes invertidos do exemplo do professor: `receba(x)` envia ao outro lado e `envie()` lê. Mantido e explicado em nota.
12. A especificação de contas diz que os filtros saíram da barra e foram para o cabeçalho das colunas, mas `TransactionFilters.js` ainda existe e é importado por `transactions/index.js`. Modelado com nota; conferir se ainda é usado ou só reaproveitado.
13. RF05 se sobrepõe a RF28 e RF29 (mesmo caso de uso UC05).
14. RF33 (duplicar lançamento): o documento de visão diz que falta a ação no Frontend; conferir antes de marcar UC13 como entregue.

## Atualização (22/11/2026)

O cálculo de saldo das contas (`PedidoCalcularSaldoContas` e `RespostaCalcularSaldoContas`) já existe no Servidor e consta nos diagramas dele. Contas, transferências, ícone e cor, exclusão com desfazer e a lista de lançamentos do cartão são do Backend e do Frontend, que não têm diagrama de classes; o contrato da API (`docs/contrato-api.md`) é a referência deles.
