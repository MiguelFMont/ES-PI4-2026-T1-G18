# Estrutura do Servidor Java

Notação UML 2 (padrão Astah). Visibilidade: `+` público, `-` privado, `#` protegido, `~` pacote. Estereótipos em «aspas angulares» no texto; nos blocos Mermaid e PlantUML aparecem como `<<estereótipo>>`. Elementos «planejado» ainda não existem no código. Cada diagrama aparece em dois blocos (Mermaid, que renderiza no GitHub, e PlantUML, que serve para recriá-lo no Astah).

Fontes: `Servidor/src/main/java/com/financeai` e `Servidor/README.md`.

## 1. Visão geral

```
Frontend --HTTP (REST)--> Backend (Express, :3001) --socket TCP, JSON por linha--> Servidor Java (:3000, só 127.0.0.1)
                          (CRUD, MongoDB, JWT)                                      (operações puras, sem banco)
```

O Servidor é um executor de operações: o Backend manda os dados no pedido, o Servidor calcula e devolve o resultado. Não acessa banco e não guarda estado entre pedidos. É a adaptação do "Fazedor de Continhas" do professor, com conversa em JSON e despacho por registro de handlers.

## 2. Pacotes e responsabilidades

Pacote raiz `com.financeai` (`Servidor/src/main/java`), um subpacote por grupo. No Astah, um pacote por subpacote.

| Pacote | Classes | Responsabilidade |
|---|---|---|
| `com.financeai` | `Main` | `PORTA_PADRAO = "3000"`. Cria `ArrayList<Parceiro> usuarios`, monta `HandlerRegistry.criarPadrao()`, inicia a `Aceitadora` e lê o console com `Teclado`. O comando `desativar` envia `ComunicadoDeDesligamento` a cada `Parceiro` e encerra. |
| `com.financeai.core` | `Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`, `Handler` «interface», `HandlerRegistry`, `ErroDeNegocio`, `EcoHandler`, `Teclado` | Infraestrutura do professor adaptada para JSON: envelope, conexão, threads e despacho. |
| `com.financeai.auth` | `AuthHandler`, `PedidoHashSenha`, `RespostaHashSenha`, `PedidoValidarSenha`, `RespostaValidarSenha` | Hash e validação de senha (PBKDF2-HMAC-SHA256, 120.000 iterações). MFA (`PedidoGerarSegredoMFA`, `PedidoValidarMFA`) só documentado em `exemplo/`, sem classe. |
| `com.financeai.transactions` | `TransactionsHandler`, `PedidoCategorizarTransacao`, `RespostaCategorizarTransacao` | Categorização por palavras-chave. «planejado»: `PedidoCalcularSaldoContas`, `RespostaCalcularSaldoContas` e o método `calcularSaldoContas`. |
| `com.financeai.dashboard` | `DashboardHandler` + 4 mensagens | Indicadores (saldo, economia, fluxo de caixa) e comparação de períodos. |
| `com.financeai.mentoria` | `MentorHandler`, `FiltroDeAtivos`, `FiltroDeEscopo`, 4 mensagens (`PedidoMontarContextoIA` com a classe aninhada `Transacao`) | Contexto da IA em texto e filtro da resposta (sem recomendação de ativo, sem fora de escopo). |
| `com.financeai.goals` | `GoalsHandler`, `PedidoProgressoMeta`, `RespostaProgressoMeta` | Progresso de meta. |
| `com.financeai.investments` | `InvestmentsHandler` + 4 mensagens | Rentabilidade simulada (juros compostos) e parcelamentos (Tabela Price). |

### Padrão de cada handler de grupo

- A classe não tem herança e **não implementa `Handler` diretamente**.
- Tem `+ registrarEm(registry: HandlerRegistry)` e métodos privados com a assinatura de `Handler.tratar`, registrados por method reference: `registry.registrar(PedidoHashSenha.TIPO, this::hashSenha)`. Assim a realização de `Handler` é feita pelo method reference.
- Cada `PedidoXxx`/`RespostaXxx` é um POJO (DTO) com a constante `TIPO`, desserializado por `Comunicado.dadosComo(Classe)`. Não estende `Comunicado` no código (o documento de arquitetura diz que estende; ver divergências no `00-README.md`). Na UML é dependência, não generalização.
- Cada grupo adiciona uma linha em `HandlerRegistry.criarPadrao()`: `new XxxHandler().registrarEm(registry)`.

## 3. Arquitetura de threads

| Elemento | Papel |
|---|---|
| `Main` (thread principal) | Sobe a `Aceitadora` e fica no laço de console (`Teclado`); `desativar` avisa todos os `Parceiro` e encerra. |
| `Aceitadora` «extends Thread» | Abre `ServerSocket` em `127.0.0.1:porta` e, em laço, faz `accept()` criando uma `Supervisora` por conexão. Recebe a lista compartilhada `usuarios` e o `HandlerRegistry`. |
| `Supervisora` «extends Thread» | Uma por conexão duradoura do pool do Backend. `TIMEOUT_LEITURA_MS = 300000` (5 min ociosos fecham a conexão; o Backend reconecta). Cria o `Parceiro`, adiciona em `usuarios` (bloco `synchronized`), e em laço lê o pedido, obtém o `Handler` pelo `tipo` e responde. `ErroDeNegocio` vira `Comunicado.erro(code, message)`; outra exceção vira `INTERNAL_ERROR` (detalhe só no log); tipo sem handler vira `UNKNOWN_TYPE`; `PedidoParaSair` remove o `Parceiro` da lista e fecha. |
| `Parceiro` | Encapsula `Socket`, `BufferedReader` e `PrintWriter`. `receba(Comunicado)` escreve uma linha JSON (protegido por `Semaphore mutEx`); `envie()` lê o próximo; `espie()` olha sem consumir; `adeus()` fecha. |
| `HandlerRegistry` | `Map<String, Handler>` por `tipo`. `registrar` recusa tipo duplicado (`IllegalStateException`); `obter` devolve `null` se não houver. |

Observação sobre nomes: `Parceiro` herdou do exemplo do professor nomes invertidos. `receba(x)` **manda** `x` ao outro lado e `envie()` **lê** o próximo comunicado. Foi mantido por fidelidade ao material.

Concorrência: cada conexão atende **um pedido por vez** (envia o pedido, lê a resposta); pedidos simultâneos usam conexões diferentes, cada uma com a sua `Supervisora`. Por isso não há ID de correlação. As operações são puras e sem estado compartilhado, exceto a lista `usuarios`, acessada sempre em `synchronized`.

## 4. Protocolo JSON

### Envelope

Uma mensagem por linha, UTF-8:

```json
{"tipo":"PedidoCategorizarTransacao","dados":{"descricao":"UBER EATS *PEDIDO","valor":54.9}}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `tipo` | `String` | Nome da mensagem (obrigatório; ausente ou em branco gera `IllegalArgumentException`). |
| `dados` | `JsonElement` | Conteúdo; se ausente vira `{}`. |

### Pedido e Resposta

- Pedido (Backend -> Servidor): `tipo = "PedidoXxx"`, `dados` com os "operandos".
- Resposta (Servidor -> Backend): `tipo = "RespostaXxx"` (um `tipo` diferente do esperado é tratado pelo Backend como 502 `JAVA_SERVER_ERROR`).
- Tipos de controle: `PedidoParaSair` (Backend -> Servidor, encerra a conexão), `ComunicadoDeDesligamento` (Servidor -> Backend, ao digitar `desativar`), `Erro`.

### Erros de negócio

```json
{"tipo":"Erro","dados":{"code":"VALIDATION","message":"..."}}
```

| `code` | Origem |
|---|---|
| `VALIDATION` | `ErroDeNegocio` lançado pelos handlers (campo ausente, valor inválido). |
| `UNKNOWN_TYPE` | `Supervisora`: `tipo` sem handler no registro. |
| `INTERNAL_ERROR` | `Supervisora`: exceção inesperada (mensagem genérica) e `Comunicado.erro(mensagem)`. |
| `TESTE_NEGOCIO` | `EcoHandler` com `{"falhar":"negocio"}` (teste). |

O Servidor não envia status HTTP: o Backend deduz o status a partir do `code` (`shared/errors/error-codes.ts`).

## 5. Mensagens por grupo e handlers

| Grupo | Pedido -> Resposta | Handler (método) | Situação |
|---|---|---|---|
| Teste | `PedidoEco` -> `RespostaEco` | `EcoHandler.eco` | implementado |
| 1 Autenticação | `PedidoHashSenha` -> `RespostaHashSenha` | `AuthHandler.hashSenha` | implementado |
| 1 Autenticação | `PedidoValidarSenha` -> `RespostaValidarSenha` | `AuthHandler.validarSenha` | implementado |
| 1 Autenticação | `PedidoGerarSegredoMFA` -> `RespostaGerarSegredoMFA`; `PedidoValidarMFA` -> `RespostaValidarMFA` | (nenhum) | só documentado (`exemplo/`) |
| 2 Transações | `PedidoCategorizarTransacao` -> `RespostaCategorizarTransacao` | `TransactionsHandler.categorizar` | implementado |
| 2 Transações | `PedidoCalcularSaldoContas` -> `RespostaCalcularSaldoContas` | `TransactionsHandler.calcularSaldoContas` | «planejado» (issue #106) |
| 3 Painel | `PedidoCalcularIndicadores` -> `RespostaCalcularIndicadores` | `DashboardHandler.calcularIndicadores` | implementado |
| 3 Painel | `PedidoCompararPeriodos` -> `RespostaCompararPeriodos` | `DashboardHandler.compararPeriodos` | implementado |
| 4 Mentor IA | `PedidoMontarContextoIA` -> `RespostaMontarContextoIA` | `MentorHandler.montarContexto` | implementado |
| 4 Mentor IA | `PedidoFiltrarResposta` -> `RespostaFiltrarResposta` | `MentorHandler.filtrarResposta` | implementado |
| 5 Metas | `PedidoProgressoMeta` -> `RespostaProgressoMeta` | `GoalsHandler.progressoMeta` | implementado |
| 5 Investimentos | `PedidoRentabilidadeSimulada` -> `RespostaRentabilidadeSimulada` | `InvestmentsHandler.rentabilidadeSimulada` | implementado (sem tela) |
| 5 Investimentos | `PedidoCalcularParcelamentos` -> `RespostaCalcularParcelamentos` | `InvestmentsHandler.calcularParcelamentos` | implementado |

Campos principais das mensagens (conforme os `.java`):

| Mensagem | Atributos |
|---|---|
| `PedidoHashSenha` | `senha: String` |
| `RespostaHashSenha` | `hash: String` |
| `PedidoValidarSenha` | `senha: String`, `hash: String` |
| `RespostaValidarSenha` | `valido: boolean` |
| `PedidoCategorizarTransacao` | `descricao: String`, `valor: double` |
| `RespostaCategorizarTransacao` | `categoria: String` |
| `PedidoCalcularSaldoContas` «planejado» | contas (com `saldoInicial`) e movimentos; nomes exatos a definir com o Backend |
| `RespostaCalcularSaldoContas` «planejado» | saldo atual de cada conta |
| `PedidoCalcularIndicadores` | `receitas: double`, `despesas: double` |
| `RespostaCalcularIndicadores` | `saldo`, `economia`, `fluxoDeCaixa` (`double`) |
| `PedidoCompararPeriodos` | `periodos: List<Map<String,Object>>` |
| `RespostaCompararPeriodos` | `periodos: List<Map<String,Object>>`, `tendenciaDespesas: String` |
| `PedidoMontarContextoIA` | `diaDoMes: int`, `transacoes: List<Transacao>` |
| `PedidoMontarContextoIA.Transacao` | `tipo`, `valor`, `categoria`, `descricao`, `data` |
| `RespostaMontarContextoIA` | `contexto: String` |
| `PedidoFiltrarResposta` | `resposta: String` |
| `RespostaFiltrarResposta` | `respostaFiltrada: String` |
| `PedidoProgressoMeta` | `valorAtual`, `valorObjetivo: double`, `prazo: String`, `hoje: String` (opcional) |
| `RespostaProgressoMeta` | `percentual`, `falta`, `aporteMensalNecessario: double`; `concluida`, `noPrazo: boolean`; `diasRestantes`, `mesesRestantes: int` |
| `PedidoRentabilidadeSimulada` | `ativos: List<Map<String,Object>>`, `meses: Integer` |
| `RespostaRentabilidadeSimulada` | `ativos`, `totalInvestido`, `patrimonio`, `rendimento`, `rentabilidade` |
| `PedidoCalcularParcelamentos` | `parcelamentos: List<Map<String,Object>>` |
| `RespostaCalcularParcelamentos` | `parcelamentos`, `totalParcelasDoMes`, `totalSaldoDevedor`, `totalJuros` |

## 6. Diagrama de classes: núcleo (core) e Main

```mermaid
classDiagram
    direction LR
    class Handler {
        <<interface>>
        +tratar(pedido: Comunicado) Comunicado
    }
    class Comunicado {
        +TIPO_PEDIDO_PARA_SAIR: String
        +TIPO_DESLIGAMENTO: String
        +TIPO_ERRO: String
        -GSON: Gson
        -tipo: String
        -dados: JsonElement
        +Comunicado(tipo: String, dados: JsonElement)
        +de(tipo: String, payload: Object) Comunicado
        +desligamento() Comunicado
        +erro(code: String, mensagem: String) Comunicado
        +erro(mensagem: String) Comunicado
        +lerJson(linha: String) Comunicado
        +paraJson() String
        +dadosComo(classe: Class~T~) T
        +getDados() JsonElement
        +getTipo() String
    }
    class Parceiro {
        -conexao: Socket
        -receptor: BufferedReader
        -transmissor: PrintWriter
        -proximoComunicado: Comunicado
        -mutEx: Semaphore
        +Parceiro(conexao: Socket, receptor: BufferedReader, transmissor: PrintWriter)
        +receba(x: Comunicado)
        +espie()
        +envie()
        +lerProximo()
        +adeus()
    }
    class Aceitadora {
        -pedido: ServerSocket
        -usuarios: ArrayList~Parceiro~
        -registry: HandlerRegistry
        +Aceitadora(porta: String, usuarios: ArrayList~Parceiro~, registry: HandlerRegistry)
        +run()
    }
    class Supervisora {
        +TIMEOUT_LEITURA_MS: int
        -usuario: Parceiro
        -conexao: Socket
        -usuarios: ArrayList~Parceiro~
        -registry: HandlerRegistry
        +Supervisora(conexao: Socket, usuarios: ArrayList~Parceiro~, registry: HandlerRegistry)
        +run()
    }
    class HandlerRegistry {
        -handlers: Map~String, Handler~
        +registrar(tipo: String, handler: Handler)
        +obter(tipo: String) Handler
        +criarPadrao() HandlerRegistry
    }
    class ErroDeNegocio {
        -serialVersionUID: long
        -code: String
        +ErroDeNegocio(code: String, mensagem: String)
        +getCode() String
    }
    class EcoHandler {
        +TIPO_PEDIDO: String
        +TIPO_RESPOSTA: String
        +registrarEm(registry: HandlerRegistry)
        -eco(pedido: Comunicado) Comunicado
    }
    class Teclado {
        -teclado: BufferedReader
        +getUmString() String
        +getUmByte() byte
        +getUmShort() short
        +getUmInt() int
        +getUmLong() long
        +getUmFloat() float
        +getUmDouble() double
        +getUmChar() char
        +getUmBoolean() boolean
    }
    class Main {
        +PORTA_PADRAO: String
        +main(args: String[])
    }
    class Thread
    class Exception

    Thread <|-- Aceitadora
    Thread <|-- Supervisora
    Exception <|-- ErroDeNegocio
    Supervisora *-- "1" Parceiro : usuario
    Aceitadora o-- "0..*" Parceiro : usuarios
    Supervisora o-- "0..*" Parceiro : usuarios
    Main o-- "0..*" Parceiro : usuarios
    Parceiro --> "0..1" Comunicado : proximoComunicado
    Aceitadora --> "1" HandlerRegistry
    Supervisora --> "1" HandlerRegistry
    HandlerRegistry o-- "0..*" Handler : por tipo
    Aceitadora ..> Supervisora : cria
    Supervisora ..> Handler
    Supervisora ..> Comunicado
    Supervisora ..> ErroDeNegocio
    Parceiro ..> Comunicado
    Handler ..> Comunicado
    EcoHandler ..> HandlerRegistry : registra
    EcoHandler ..> Comunicado
    EcoHandler ..> ErroDeNegocio
    Main ..> HandlerRegistry
    Main ..> Aceitadora
    Main ..> Teclado
    Main ..> Comunicado
```

```plantuml
@startuml
left to right direction
skinparam classAttributeIconSize 0

interface Handler <<interface>> {
  + tratar(pedido: Comunicado): Comunicado
}
class Comunicado {
  + {static} TIPO_PEDIDO_PARA_SAIR: String
  + {static} TIPO_DESLIGAMENTO: String
  + {static} TIPO_ERRO: String
  - {static} GSON: Gson
  - tipo: String
  - dados: JsonElement
  + Comunicado(tipo: String, dados: JsonElement)
  + {static} de(tipo: String, payload: Object): Comunicado
  + {static} desligamento(): Comunicado
  + {static} erro(code: String, mensagem: String): Comunicado
  + {static} erro(mensagem: String): Comunicado
  + {static} lerJson(linha: String): Comunicado
  + paraJson(): String
  + dadosComo(classe: Class<T>): T
  + getDados(): JsonElement
  + getTipo(): String
}
class Parceiro {
  - conexao: Socket
  - receptor: BufferedReader
  - transmissor: PrintWriter
  - proximoComunicado: Comunicado
  - mutEx: Semaphore
  + Parceiro(conexao: Socket, receptor: BufferedReader, transmissor: PrintWriter)
  + receba(x: Comunicado)
  + espie()
  + envie()
  + lerProximo()
  + adeus()
}
class Aceitadora {
  - pedido: ServerSocket
  - usuarios: ArrayList<Parceiro>
  - registry: HandlerRegistry
  + Aceitadora(porta: String, usuarios: ArrayList<Parceiro>, registry: HandlerRegistry)
  + run()
}
class Supervisora {
  + {static} TIMEOUT_LEITURA_MS: int
  - usuario: Parceiro
  - conexao: Socket
  - usuarios: ArrayList<Parceiro>
  - registry: HandlerRegistry
  + Supervisora(conexao: Socket, usuarios: ArrayList<Parceiro>, registry: HandlerRegistry)
  + run()
}
class HandlerRegistry {
  - handlers: Map<String, Handler>
  + registrar(tipo: String, handler: Handler)
  + obter(tipo: String): Handler
  + {static} criarPadrao(): HandlerRegistry
}
class ErroDeNegocio {
  - serialVersionUID: long
  - code: String
  + ErroDeNegocio(code: String, mensagem: String)
  + getCode(): String
}
class EcoHandler {
  + {static} TIPO_PEDIDO: String
  + {static} TIPO_RESPOSTA: String
  + registrarEm(registry: HandlerRegistry)
  - eco(pedido: Comunicado): Comunicado
}
class Teclado {
  - teclado: BufferedReader
  + getUmString(): String
  + getUmByte(): byte
  + getUmShort(): short
  + getUmInt(): int
  + getUmLong(): long
  + getUmFloat(): float
  + getUmDouble(): double
  + getUmChar(): char
  + getUmBoolean(): boolean
}
class Main {
  + {static} PORTA_PADRAO: String
  + {static} main(args: String[])
}
class Thread
class Exception

Thread <|-- Aceitadora
Thread <|-- Supervisora
Exception <|-- ErroDeNegocio
Supervisora *-- "1" Parceiro : usuario
Aceitadora o-- "0..*" Parceiro : usuarios
Supervisora o-- "0..*" Parceiro : usuarios
Main o-- "0..*" Parceiro : usuarios
Parceiro --> "0..1" Comunicado : proximoComunicado
Aceitadora --> "1" HandlerRegistry
Supervisora --> "1" HandlerRegistry
HandlerRegistry o-- "0..*" Handler : por tipo
Aceitadora ..> Supervisora : cria
Supervisora ..> Handler
Supervisora ..> Comunicado
Supervisora ..> ErroDeNegocio
Parceiro ..> Comunicado
Handler ..> Comunicado
EcoHandler ..> HandlerRegistry : <<registra>>
EcoHandler ..> Comunicado
EcoHandler ..> ErroDeNegocio
Main ..> HandlerRegistry
Main ..> Aceitadora
Main ..> Teclado
Main ..> Comunicado
@enduml
```

## 7. Diagrama de classes: registro dos handlers

Os handlers de grupo não implementam `Handler`: registram métodos privados por method reference em `registrarEm`. A dependência «registra» substitui a realização.

```mermaid
classDiagram
    direction LR
    class Handler {
        <<interface>>
        +tratar(pedido: Comunicado) Comunicado
    }
    class HandlerRegistry {
        -handlers: Map~String, Handler~
        +registrar(tipo: String, handler: Handler)
        +obter(tipo: String) Handler
        +criarPadrao() HandlerRegistry
    }
    class EcoHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry)
        -eco(pedido: Comunicado) Comunicado
    }
    class AuthHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry)
        -hashSenha(pedido: Comunicado) Comunicado
        -validarSenha(pedido: Comunicado) Comunicado
        -pbkdf2(senha: String, sal: byte[]) byte[]
        -b64(bytes: byte[]) String
    }
    class TransactionsHandler {
        <<handler>>
        -CATEGORIA_PADRAO: String
        -RUIDO: Set~String~
        -REGRAS: String[][]
        +registrarEm(registry: HandlerRegistry)
        -categorizar(pedido: Comunicado) Comunicado
        -categoriaDe(descricao: String) String
        -normalizar(texto: String) String
        -calcularSaldoContas(pedido: Comunicado) Comunicado
    }
    class DashboardHandler {
        <<handler>>
        -LIMITE_TENDENCIA: double
        +registrarEm(registry: HandlerRegistry)
        -calcularIndicadores(pedido: Comunicado) Comunicado
        -compararPeriodos(pedido: Comunicado) Comunicado
        -variacao(anterior: double, atual: double) double
        -numero(mapa: Map, chave: String) double
    }
    class MentorHandler {
        <<handler>>
        -PT_BR: Locale
        -MAX_CATEGORIAS: int
        -MAIORES_DESPESAS: int
        -MAX_CARACTERES_DESCR: int
        +registrarEm(registry: HandlerRegistry)
        -montarContexto(pedido: Comunicado) Comunicado
        -filtrarResposta(pedido: Comunicado) Comunicado
    }
    class GoalsHandler {
        <<handler>>
        -DIAS_POR_MES: double
        +registrarEm(registry: HandlerRegistry)
        -progressoMeta(pedido: Comunicado) Comunicado
    }
    class InvestmentsHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry)
        -rentabilidadeSimulada(pedido: Comunicado) Comunicado
        -calcularParcelamentos(pedido: Comunicado) Comunicado
    }
    class ErroDeNegocio
    class Comunicado
    class Planejado_nota {
        <<planejado>>
        calcularSaldoContas ainda nao existe no codigo
    }

    HandlerRegistry o-- "0..*" Handler
    HandlerRegistry ..> EcoHandler : criarPadrao
    HandlerRegistry ..> AuthHandler : criarPadrao
    HandlerRegistry ..> MentorHandler : criarPadrao
    HandlerRegistry ..> TransactionsHandler : criarPadrao
    HandlerRegistry ..> DashboardHandler : criarPadrao
    HandlerRegistry ..> GoalsHandler : criarPadrao
    HandlerRegistry ..> InvestmentsHandler : criarPadrao
    EcoHandler ..> HandlerRegistry : registra
    AuthHandler ..> HandlerRegistry : registra
    TransactionsHandler ..> HandlerRegistry : registra
    DashboardHandler ..> HandlerRegistry : registra
    MentorHandler ..> HandlerRegistry : registra
    GoalsHandler ..> HandlerRegistry : registra
    InvestmentsHandler ..> HandlerRegistry : registra
    AuthHandler ..> ErroDeNegocio
    TransactionsHandler ..> ErroDeNegocio
    DashboardHandler ..> ErroDeNegocio
    MentorHandler ..> ErroDeNegocio
    GoalsHandler ..> ErroDeNegocio
    InvestmentsHandler ..> ErroDeNegocio
    AuthHandler ..> Comunicado
    Planejado_nota .. TransactionsHandler
```

```plantuml
@startuml
left to right direction
skinparam classAttributeIconSize 0

interface Handler <<interface>> {
  + tratar(pedido: Comunicado): Comunicado
}
class HandlerRegistry {
  - handlers: Map<String, Handler>
  + registrar(tipo: String, handler: Handler)
  + obter(tipo: String): Handler
  + {static} criarPadrao(): HandlerRegistry
}
class EcoHandler <<handler>> {
  + registrarEm(registry: HandlerRegistry)
  - eco(pedido: Comunicado): Comunicado
}
class AuthHandler <<handler>> {
  + registrarEm(registry: HandlerRegistry)
  - hashSenha(pedido: Comunicado): Comunicado
  - validarSenha(pedido: Comunicado): Comunicado
  - {static} pbkdf2(senha: String, sal: byte[]): byte[]
  - {static} b64(bytes: byte[]): String
}
class TransactionsHandler <<handler>> {
  - CATEGORIA_PADRAO: String
  - RUIDO: Set<String>
  - REGRAS: String[][]
  + registrarEm(registry: HandlerRegistry)
  - categorizar(pedido: Comunicado): Comunicado
  - {static} categoriaDe(descricao: String): String
  - {static} normalizar(texto: String): String
  - calcularSaldoContas(pedido: Comunicado): Comunicado <<planejado>>
}
class DashboardHandler <<handler>> {
  - LIMITE_TENDENCIA: double
  + registrarEm(registry: HandlerRegistry)
  - calcularIndicadores(pedido: Comunicado): Comunicado
  - compararPeriodos(pedido: Comunicado): Comunicado
  - variacao(anterior: double, atual: double): double
  - numero(mapa: Map, chave: String): double
}
class MentorHandler <<handler>> {
  - PT_BR: Locale
  - MAX_CATEGORIAS: int
  - MAIORES_DESPESAS: int
  - MAX_CARACTERES_DESCR: int
  + registrarEm(registry: HandlerRegistry)
  - montarContexto(pedido: Comunicado): Comunicado
  - filtrarResposta(pedido: Comunicado): Comunicado
}
class GoalsHandler <<handler>> {
  - DIAS_POR_MES: double
  + registrarEm(registry: HandlerRegistry)
  - progressoMeta(pedido: Comunicado): Comunicado
}
class InvestmentsHandler <<handler>> {
  + registrarEm(registry: HandlerRegistry)
  - rentabilidadeSimulada(pedido: Comunicado): Comunicado
  - calcularParcelamentos(pedido: Comunicado): Comunicado
}
class ErroDeNegocio
class Comunicado
note bottom of TransactionsHandler
  <<planejado>>: calcularSaldoContas ainda nao
  existe no codigo (issue #106).
end note

HandlerRegistry o-- "0..*" Handler
HandlerRegistry ..> EcoHandler : criarPadrao
HandlerRegistry ..> AuthHandler : criarPadrao
HandlerRegistry ..> MentorHandler : criarPadrao
HandlerRegistry ..> TransactionsHandler : criarPadrao
HandlerRegistry ..> DashboardHandler : criarPadrao
HandlerRegistry ..> GoalsHandler : criarPadrao
HandlerRegistry ..> InvestmentsHandler : criarPadrao
EcoHandler ..> HandlerRegistry : <<registra>>
AuthHandler ..> HandlerRegistry : <<registra>>
TransactionsHandler ..> HandlerRegistry : <<registra>>
DashboardHandler ..> HandlerRegistry : <<registra>>
MentorHandler ..> HandlerRegistry : <<registra>>
GoalsHandler ..> HandlerRegistry : <<registra>>
InvestmentsHandler ..> HandlerRegistry : <<registra>>
AuthHandler ..> ErroDeNegocio
TransactionsHandler ..> ErroDeNegocio
DashboardHandler ..> ErroDeNegocio
MentorHandler ..> ErroDeNegocio
GoalsHandler ..> ErroDeNegocio
InvestmentsHandler ..> ErroDeNegocio
AuthHandler ..> Comunicado
@enduml
```

As mensagens (`PedidoXxx`/`RespostaXxx`) de cada grupo são detalhadas em `04-diagrama-de-classes-servidor.md`; os atributos estão na tabela da seção 5.

## 8. Diagrama de sequência: um pedido

Exemplo com a categorização (`PedidoCategorizarTransacao`); vale para qualquer mensagem. A conexão já existe (duradoura, do pool do Backend), então a `Supervisora` já foi criada pela `Aceitadora` na abertura.

```mermaid
sequenceDiagram
    participant B as Backend (javaServerClient)
    participant A as Aceitadora
    participant S as Supervisora
    participant R as HandlerRegistry
    participant H as TransactionsHandler
    Note over B,A: abertura da conexao (uma vez, depois reutilizada)
    B->>A: connect (127.0.0.1:3000)
    A->>S: new Supervisora(conexao, usuarios, registry).start()
    S->>S: cria Parceiro e adiciona em usuarios (synchronized)
    Note over B,S: pedido (um por vez por conexao)
    B->>S: linha JSON {tipo: PedidoCategorizarTransacao, dados}
    S->>S: usuario.envie() e Comunicado.lerJson
    S->>R: obter(tipo)
    R-->>S: Handler (ou null)
    alt tipo sem handler
        S-->>B: Erro UNKNOWN_TYPE
    else handler encontrado
        S->>H: tratar(pedido)
        H->>H: pedido.dadosComo(PedidoCategorizarTransacao)
        alt ErroDeNegocio
            H-->>S: throw ErroDeNegocio(VALIDATION)
            S-->>B: Erro {code, message}
        else outra excecao
            H-->>S: throw Exception
            S-->>B: Erro INTERNAL_ERROR
        else sucesso
            H-->>S: Comunicado RespostaCategorizarTransacao
            S-->>B: usuario.receba(resposta) como linha JSON
        end
    end
    Note over B,S: encerramento
    B->>S: PedidoParaSair
    S->>S: remove Parceiro de usuarios e adeus()
```

```plantuml
@startuml
participant "Backend (javaServerClient)" as B
participant Aceitadora as A
participant Supervisora as S
participant HandlerRegistry as R
participant TransactionsHandler as H

note over B, A: abertura da conexao (uma vez, depois reutilizada)
B -> A : connect (127.0.0.1:3000)
A -> S : new Supervisora(conexao, usuarios, registry).start()
S -> S : cria Parceiro e adiciona em usuarios (synchronized)
note over B, S: pedido (um por vez por conexao)
B -> S : linha JSON {tipo: PedidoCategorizarTransacao, dados}
S -> S : usuario.envie() e Comunicado.lerJson
S -> R : obter(tipo)
R --> S : Handler (ou null)
alt tipo sem handler
  S --> B : Erro UNKNOWN_TYPE
else handler encontrado
  S -> H : tratar(pedido)
  H -> H : pedido.dadosComo(PedidoCategorizarTransacao)
  alt ErroDeNegocio
    H --> S : throw ErroDeNegocio(VALIDATION)
    S --> B : Erro {code, message}
  else outra excecao
    H --> S : throw Exception
    S --> B : Erro INTERNAL_ERROR
  else sucesso
    H --> S : Comunicado RespostaCategorizarTransacao
    S --> B : usuario.receba(resposta) como linha JSON
  end
end
note over B, S: encerramento
B -> S : PedidoParaSair
S -> S : remove Parceiro de usuarios e adeus()
@enduml
```

## 9. Planejado: `PedidoCalcularSaldoContas` «planejado»

Ainda não existe como `.java` (issue #106; ver `docs/especificacao-contas-e-transferencias.md`, seção 5). Operação pura, como as demais: o Backend lê contas e movimentos no MongoDB e manda tudo no pedido; o Servidor devolve o saldo atual de cada conta.

| Item | Descrição |
|---|---|
| Pedido | `PedidoCalcularSaldoContas`: contas (cada uma com `saldoInicial`) e movimentos (receitas, despesas e transferências). Nomes exatos a definir com o Backend. |
| Resposta | `RespostaCalcularSaldoContas`: saldo atual de cada conta. |
| Handler | `TransactionsHandler.calcularSaldoContas` «planejado». |
| Regra (RN2, RN6, RN9) | `saldoAtual = saldoInicial + receitas - despesas ± transferências`; a transferência subtrai da conta de origem e soma na de destino. O saldo é sempre calculado, nunca gravado. |
| Chamador | Backend (`GET /accounts` e a criação de transferência). |

```mermaid
classDiagram
    direction LR
    class TransactionsHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry)
        -categorizar(pedido: Comunicado) Comunicado
        -calcularSaldoContas(pedido: Comunicado) Comunicado
    }
    class PedidoCategorizarTransacao {
        <<dto>>
        +TIPO: String
        -descricao: String
        -valor: double
    }
    class RespostaCategorizarTransacao {
        <<dto>>
        +TIPO: String
        -categoria: String
    }
    class PedidoCalcularSaldoContas {
        <<planejado>>
        <<dto>>
        +TIPO: String
        -contas: lista
        -movimentos: lista
    }
    class RespostaCalcularSaldoContas {
        <<planejado>>
        <<dto>>
        +TIPO: String
        -saldos: lista
    }
    TransactionsHandler ..> PedidoCategorizarTransacao
    TransactionsHandler ..> RespostaCategorizarTransacao
    TransactionsHandler ..> PedidoCalcularSaldoContas
    TransactionsHandler ..> RespostaCalcularSaldoContas
```

```plantuml
@startuml
left to right direction
skinparam classAttributeIconSize 0
class TransactionsHandler <<handler>> {
  + registrarEm(registry: HandlerRegistry)
  - categorizar(pedido: Comunicado): Comunicado
  - calcularSaldoContas(pedido: Comunicado): Comunicado <<planejado>>
}
class PedidoCategorizarTransacao <<dto>> {
  + {static} TIPO: String
  - descricao: String
  - valor: double
}
class RespostaCategorizarTransacao <<dto>> {
  + {static} TIPO: String
  - categoria: String
}
class PedidoCalcularSaldoContas <<planejado>> <<dto>> {
  + {static} TIPO: String
  - contas: lista
  - movimentos: lista
}
class RespostaCalcularSaldoContas <<planejado>> <<dto>> {
  + {static} TIPO: String
  - saldos: lista
}
TransactionsHandler ..> PedidoCategorizarTransacao
TransactionsHandler ..> RespostaCategorizarTransacao
TransactionsHandler ..> PedidoCalcularSaldoContas
TransactionsHandler ..> RespostaCalcularSaldoContas
@enduml
```
