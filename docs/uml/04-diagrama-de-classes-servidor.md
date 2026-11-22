# Diagramas de classes do Servidor Java

Diagramas de classes (UML 2, padrão Astah) do Servidor Java do FinanceAI. Cada diagrama aparece em dois blocos: `mermaid` (renderiza no GitHub) e `plantuml` (descreve o mesmo diagrama; serve para recriá-lo no Astah).

## Legenda

- Visibilidade: `+` público, `-` privado, `#` protegido, `~` pacote. Atributo: `- nome: Tipo`. Operação: `+ nome(param: Tipo): Retorno`.
- Estereótipos: «interface», «handler» (classe que registra e trata mensagens), «dto» (mensagem de pedido/resposta com constante `TIPO`), «planejado» (elemento que ainda não existe no código; ver `docs/especificacao-contas-e-transferencias.md`).
- Relações: generalização (seta com triângulo cheio), realização, associação, agregação (losango vazio), composição (losango cheio), dependência (tracejada).
- Multiplicidade: `1`, `0..1`, `*`, `1..*`.

---

## 1. Servidor — núcleo (core) e Main

```mermaid
classDiagram
    direction LR
    class Main {
        +PORTA_PADRAO: String
        +main(args: String[]) void
    }
    class Aceitadora {
        -pedido: ServerSocket
        -usuarios: ArrayList~Parceiro~
        -registry: HandlerRegistry
        +Aceitadora(porta: String, usuarios: ArrayList~Parceiro~, registry: HandlerRegistry)
        +run() void
    }
    class Supervisora {
        +TIMEOUT_LEITURA_MS: int
        -usuario: Parceiro
        -conexao: Socket
        -usuarios: ArrayList~Parceiro~
        -registry: HandlerRegistry
        +Supervisora(conexao: Socket, usuarios: ArrayList~Parceiro~, registry: HandlerRegistry)
        +run() void
    }
    class Parceiro {
        -conexao: Socket
        -receptor: BufferedReader
        -transmissor: PrintWriter
        -proximoComunicado: Comunicado
        -mutEx: Semaphore
        +Parceiro(conexao: Socket, receptor: BufferedReader, transmissor: PrintWriter)
        +receba(x: Comunicado) void
        +espie() Comunicado
        +envie() Comunicado
        +lerProximo() Comunicado
        +adeus() void
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
    class Handler {
        <<interface>>
        +tratar(pedido: Comunicado) Comunicado
    }
    class HandlerRegistry {
        -handlers: Map~String, Handler~
        +registrar(tipo: String, handler: Handler) void
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
        +registrarEm(registry: HandlerRegistry) void
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
    class Thread
    class Exception

    Aceitadora --|> Thread
    Supervisora --|> Thread
    ErroDeNegocio --|> Exception
    Aceitadora "1" --> "*" Supervisora : cria
    Supervisora "1" *-- "1" Parceiro
    Main o-- "*" Parceiro : usuarios
    Aceitadora o-- "*" Parceiro : usuarios
    Supervisora o-- "*" Parceiro : usuarios
    Aceitadora "1" --> "1" HandlerRegistry
    Supervisora "1" --> "1" HandlerRegistry
    HandlerRegistry "1" o--> "*" Handler : por tipo
    Parceiro "1" --> "0..1" Comunicado : proximoComunicado
    Supervisora ..> Handler
    Supervisora ..> Comunicado
    Supervisora ..> ErroDeNegocio
    Parceiro ..> Comunicado
    Aceitadora ..> Supervisora
    Main ..> HandlerRegistry
    Main ..> Aceitadora
    Main ..> Teclado
    Main ..> Comunicado
    EcoHandler ..> HandlerRegistry
    EcoHandler ..> Comunicado
    EcoHandler ..> ErroDeNegocio
    EcoHandler ..> Handler
    Handler ..> Comunicado
```

```plantuml
@startuml
title Servidor — núcleo (core) e Main
left to right direction
skinparam classAttributeIconSize 0

class Main {
  +PORTA_PADRAO: String
  +main(args: String[]): void
}
class Aceitadora {
  -pedido: ServerSocket
  -usuarios: ArrayList<Parceiro>
  -registry: HandlerRegistry
  +Aceitadora(porta: String, usuarios: ArrayList<Parceiro>, registry: HandlerRegistry)
  +run(): void
}
class Supervisora {
  +TIMEOUT_LEITURA_MS: int
  -usuario: Parceiro
  -conexao: Socket
  -usuarios: ArrayList<Parceiro>
  -registry: HandlerRegistry
  +Supervisora(conexao: Socket, usuarios: ArrayList<Parceiro>, registry: HandlerRegistry)
  +run(): void
}
class Parceiro {
  -conexao: Socket
  -receptor: BufferedReader
  -transmissor: PrintWriter
  -proximoComunicado: Comunicado
  -mutEx: Semaphore
  +Parceiro(conexao: Socket, receptor: BufferedReader, transmissor: PrintWriter)
  +receba(x: Comunicado): void
  +espie(): Comunicado
  +envie(): Comunicado
  +lerProximo(): Comunicado
  +adeus(): void
}
class Comunicado {
  +TIPO_PEDIDO_PARA_SAIR: String
  +TIPO_DESLIGAMENTO: String
  +TIPO_ERRO: String
  -GSON: Gson
  -tipo: String
  -dados: JsonElement
  +Comunicado(tipo: String, dados: JsonElement)
  +de(tipo: String, payload: Object): Comunicado
  +desligamento(): Comunicado
  +erro(code: String, mensagem: String): Comunicado
  +erro(mensagem: String): Comunicado
  +lerJson(linha: String): Comunicado
  +paraJson(): String
  +dadosComo(classe: Class<T>): T
  +getDados(): JsonElement
  +getTipo(): String
}
interface Handler <<interface>> {
  +tratar(pedido: Comunicado): Comunicado
}
class HandlerRegistry {
  -handlers: Map<String, Handler>
  +registrar(tipo: String, handler: Handler): void
  +obter(tipo: String): Handler
  +criarPadrao(): HandlerRegistry
}
class ErroDeNegocio {
  -serialVersionUID: long
  -code: String
  +ErroDeNegocio(code: String, mensagem: String)
  +getCode(): String
}
class EcoHandler {
  +TIPO_PEDIDO: String
  +TIPO_RESPOSTA: String
  +registrarEm(registry: HandlerRegistry): void
  -eco(pedido: Comunicado): Comunicado
}
class Teclado {
  -teclado: BufferedReader
  +getUmString(): String
  +getUmByte(): byte
  +getUmShort(): short
  +getUmInt(): int
  +getUmLong(): long
  +getUmFloat(): float
  +getUmDouble(): double
  +getUmChar(): char
  +getUmBoolean(): boolean
}
class Thread
class Exception

Aceitadora --|> Thread
Supervisora --|> Thread
ErroDeNegocio --|> Exception
Aceitadora "1" --> "*" Supervisora : cria
Supervisora "1" *-- "1" Parceiro
Main o-- "*" Parceiro : usuarios
Aceitadora o-- "*" Parceiro : usuarios
Supervisora o-- "*" Parceiro : usuarios
Aceitadora "1" --> "1" HandlerRegistry
Supervisora "1" --> "1" HandlerRegistry
HandlerRegistry "1" o--> "*" Handler : por tipo
Parceiro "1" --> "0..1" Comunicado : proximoComunicado
Supervisora ..> Handler
Supervisora ..> Comunicado
Supervisora ..> ErroDeNegocio
Parceiro ..> Comunicado
Aceitadora ..> Supervisora
Main ..> HandlerRegistry
Main ..> Aceitadora
Main ..> Teclado
Main ..> Comunicado
EcoHandler ..> HandlerRegistry
EcoHandler ..> Comunicado
EcoHandler ..> ErroDeNegocio
EcoHandler ..> Handler
Handler ..> Comunicado
@enduml
```

---

## 2. Servidor — registro dos handlers dos grupos

Visão de pacotes. Cada handler expõe `registrarEm(registry)` e registra seus métodos privados de tratamento no `HandlerRegistry` como method reference, que cumpre o contrato da interface `Handler` (por isso não há seta de realização). `TransactionsHandler.calcularSaldoContas` é «planejado».

```mermaid
classDiagram
    direction TB
    class Handler {
        <<interface>>
        +tratar(pedido: Comunicado) Comunicado
    }
    class HandlerRegistry {
        -handlers: Map~String, Handler~
        +registrar(tipo: String, handler: Handler) void
        +obter(tipo: String) Handler
        +criarPadrao() HandlerRegistry
    }
    class EcoHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -eco(pedido: Comunicado) Comunicado
    }
    class AuthHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -hashSenha(pedido: Comunicado) Comunicado
        -validarSenha(pedido: Comunicado) Comunicado
    }
    class TransactionsHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -categorizar(pedido: Comunicado) Comunicado
        -calcularSaldoContas(pedido: Comunicado) Comunicado
    }
    class DashboardHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -calcularIndicadores(pedido: Comunicado) Comunicado
        -compararPeriodos(pedido: Comunicado) Comunicado
    }
    class MentorHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -montarContexto(pedido: Comunicado) Comunicado
        -filtrarResposta(pedido: Comunicado) Comunicado
    }
    class GoalsHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -progressoMeta(pedido: Comunicado) Comunicado
    }
    class InvestmentsHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -rentabilidadeSimulada(pedido: Comunicado) Comunicado
        -calcularParcelamentos(pedido: Comunicado) Comunicado
    }
    note for Handler "Pacote srv-core. Os handlers registram method references (Comunicado -> Comunicado), que realizam Handler."
    note for TransactionsHandler "calcularSaldoContas e PLANEJADO: ainda nao existe no codigo."

    HandlerRegistry "1" o--> "*" Handler : por tipo
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
```

```plantuml
@startuml
title Servidor — registro dos handlers dos grupos
skinparam classAttributeIconSize 0

package "srv-core" {
  interface Handler <<interface>> {
    +tratar(pedido: Comunicado): Comunicado
  }
  class HandlerRegistry {
    -handlers: Map<String, Handler>
    +registrar(tipo: String, handler: Handler): void
    +obter(tipo: String): Handler
    +criarPadrao(): HandlerRegistry
  }
  class EcoHandler <<handler>> {
    +registrarEm(registry: HandlerRegistry): void
    -eco(pedido: Comunicado): Comunicado
  }
}
package "srv-auth" {
  class AuthHandler <<handler>> {
    +registrarEm(registry: HandlerRegistry): void
    -hashSenha(pedido: Comunicado): Comunicado
    -validarSenha(pedido: Comunicado): Comunicado
  }
}
package "srv-transactions" {
  class TransactionsHandler <<handler>> {
    +registrarEm(registry: HandlerRegistry): void
    -categorizar(pedido: Comunicado): Comunicado
    -calcularSaldoContas(pedido: Comunicado): Comunicado <<planejado>>
  }
}
package "srv-dashboard" {
  class DashboardHandler <<handler>> {
    +registrarEm(registry: HandlerRegistry): void
    -calcularIndicadores(pedido: Comunicado): Comunicado
    -compararPeriodos(pedido: Comunicado): Comunicado
  }
}
package "srv-mentoria" {
  class MentorHandler <<handler>> {
    +registrarEm(registry: HandlerRegistry): void
    -montarContexto(pedido: Comunicado): Comunicado
    -filtrarResposta(pedido: Comunicado): Comunicado
  }
}
package "srv-goals" {
  class GoalsHandler <<handler>> {
    +registrarEm(registry: HandlerRegistry): void
    -progressoMeta(pedido: Comunicado): Comunicado
  }
}
package "srv-investments" {
  class InvestmentsHandler <<handler>> {
    +registrarEm(registry: HandlerRegistry): void
    -rentabilidadeSimulada(pedido: Comunicado): Comunicado
    -calcularParcelamentos(pedido: Comunicado): Comunicado
  }
}

note top of Handler
  Pacote srv-core. Os handlers registram method references
  (Comunicado -> Comunicado), que realizam Handler.
end note
note right of TransactionsHandler
  calcularSaldoContas e PLANEJADO:
  ainda nao existe no codigo.
end note

HandlerRegistry "1" o--> "*" Handler : por tipo
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
@enduml
```

---

## 3. Servidor — Autenticação e Transações (mensagens)

`PedidoCalcularSaldoContas` e `RespostaCalcularSaldoContas` são «planejado» (contas e transferências).

```mermaid
classDiagram
    direction LR
    class AuthHandler {
        <<handler>>
        +registrarEm(HandlerRegistry registry) void
        +hashSenha(Comunicado pedido) Comunicado
        +validarSenha(Comunicado pedido) Comunicado
        +pbkdf2(String senha, byte[] sal) byte[]$
        +b64(byte[] bytes) String$
    }
    class PedidoHashSenha {
        <<dto>>
        +TIPO: String
        -senha: String
        +getSenha() String
    }
    class RespostaHashSenha {
        <<dto>>
        +TIPO: String
        -hash: String
        +RespostaHashSenha(String hash)
        +getHash() String
    }
    class PedidoValidarSenha {
        <<dto>>
        +TIPO: String
        -senha: String
        -hash: String
        +getSenha() String
        +getHash() String
    }
    class RespostaValidarSenha {
        <<dto>>
        +TIPO: String
        -valido: boolean
        +RespostaValidarSenha(boolean valido)
        +getValido() boolean
    }
    class TransactionsHandler {
        <<handler>>
        -CATEGORIA_PADRAO: String
        -RUIDO: Set~String~
        -REGRAS: String[][]
        +registrarEm(HandlerRegistry registry) void
        +categorizar(Comunicado pedido) Comunicado
        +categoriaDe(String descricao) String$
        +normalizar(String texto) String$
    }
    class PedidoCategorizarTransacao {
        <<dto>>
        +TIPO: String
        -descricao: String
        -valor: double
        +getDescricao() String
        +getValor() double
    }
    class RespostaCategorizarTransacao {
        <<dto>>
        +TIPO: String
        -categoria: String
        +RespostaCategorizarTransacao(String categoria)
        +getCategoria() String
    }
    class PedidoCalcularSaldoContas {
        <<planejado>>
        -contas: List
        -movimentos: List
    }
    class RespostaCalcularSaldoContas {
        <<planejado>>
        -saldos: List
    }
    class Comunicado {
        +dadosComo(classe: Class~T~) T
    }
    class ErroDeNegocio
    class HandlerRegistry

    AuthHandler ..> HandlerRegistry
    AuthHandler ..> Comunicado
    AuthHandler ..> ErroDeNegocio
    AuthHandler ..> PedidoHashSenha
    AuthHandler ..> PedidoValidarSenha
    AuthHandler ..> RespostaHashSenha
    AuthHandler ..> RespostaValidarSenha
    TransactionsHandler ..> HandlerRegistry
    TransactionsHandler ..> Comunicado
    TransactionsHandler ..> ErroDeNegocio
    TransactionsHandler ..> PedidoCategorizarTransacao
    TransactionsHandler ..> RespostaCategorizarTransacao
    TransactionsHandler ..> PedidoCalcularSaldoContas : planejado
    TransactionsHandler ..> RespostaCalcularSaldoContas : planejado
    Comunicado ..> PedidoHashSenha : dadosComo cria
    Comunicado ..> PedidoValidarSenha : dadosComo cria
    Comunicado ..> PedidoCategorizarTransacao : dadosComo cria
    Comunicado ..> PedidoCalcularSaldoContas : dadosComo cria
```

```plantuml
@startuml
title Servidor — Autenticação e Transações (mensagens)
left to right direction
skinparam classAttributeIconSize 0

class AuthHandler <<handler>> {
  +registrarEm(HandlerRegistry registry): void
  +hashSenha(Comunicado pedido): Comunicado
  +validarSenha(Comunicado pedido): Comunicado
  {static} +pbkdf2(String senha, byte[] sal): byte[]
  {static} +b64(byte[] bytes): String
}
class PedidoHashSenha <<dto>> {
  +TIPO: String
  -senha: String
  +getSenha(): String
}
class RespostaHashSenha <<dto>> {
  +TIPO: String
  -hash: String
  +RespostaHashSenha(String hash)
  +getHash(): String
}
class PedidoValidarSenha <<dto>> {
  +TIPO: String
  -senha: String
  -hash: String
  +getSenha(): String
  +getHash(): String
}
class RespostaValidarSenha <<dto>> {
  +TIPO: String
  -valido: boolean
  +RespostaValidarSenha(boolean valido)
  +getValido(): boolean
}
class TransactionsHandler <<handler>> {
  -CATEGORIA_PADRAO: String
  -RUIDO: Set<String>
  -REGRAS: String[][]
  +registrarEm(HandlerRegistry registry): void
  +categorizar(Comunicado pedido): Comunicado
  {static} +categoriaDe(String descricao): String
  {static} +normalizar(String texto): String
}
class PedidoCategorizarTransacao <<dto>> {
  +TIPO: String
  -descricao: String
  -valor: double
  +getDescricao(): String
  +getValor(): double
}
class RespostaCategorizarTransacao <<dto>> {
  +TIPO: String
  -categoria: String
  +RespostaCategorizarTransacao(String categoria)
  +getCategoria(): String
}
class PedidoCalcularSaldoContas <<dto>> <<planejado>> {
  -contas: List
  -movimentos: List
}
class RespostaCalcularSaldoContas <<dto>> <<planejado>> {
  -saldos: List
}
class Comunicado {
  +dadosComo(classe: Class<T>): T
}
class ErroDeNegocio
class HandlerRegistry

AuthHandler ..> HandlerRegistry
AuthHandler ..> Comunicado
AuthHandler ..> ErroDeNegocio
AuthHandler ..> PedidoHashSenha
AuthHandler ..> PedidoValidarSenha
AuthHandler ..> RespostaHashSenha
AuthHandler ..> RespostaValidarSenha
TransactionsHandler ..> HandlerRegistry
TransactionsHandler ..> Comunicado
TransactionsHandler ..> ErroDeNegocio
TransactionsHandler ..> PedidoCategorizarTransacao
TransactionsHandler ..> RespostaCategorizarTransacao
TransactionsHandler ..> PedidoCalcularSaldoContas : planejado
TransactionsHandler ..> RespostaCalcularSaldoContas : planejado
Comunicado ..> PedidoHashSenha : dadosComo cria
Comunicado ..> PedidoValidarSenha : dadosComo cria
Comunicado ..> PedidoCategorizarTransacao : dadosComo cria
Comunicado ..> PedidoCalcularSaldoContas : dadosComo cria
@enduml
```

---

## 4. Servidor — Painel e Metas (mensagens)

```mermaid
classDiagram
    direction LR
    class DashboardHandler {
        <<handler>>
        -LIMITE_TENDENCIA: double
        +registrarEm(registry: HandlerRegistry) void
        -calcularIndicadores(pedido: Comunicado) Comunicado
        -compararPeriodos(pedido: Comunicado) Comunicado
        -variacao(anterior: double, atual: double) double
        -numero(mapa: Map, chave: String) double
    }
    class PedidoCalcularIndicadores {
        <<dto>>
        +TIPO: String
        -receitas: double
        -despesas: double
        +PedidoCalcularIndicadores()
        +PedidoCalcularIndicadores(receitas: double, despesas: double)
        +getReceitas() double
        +getDespesas() double
        +toString() String
    }
    class RespostaCalcularIndicadores {
        <<dto>>
        +TIPO: String
        -saldo: double
        -economia: double
        -fluxoDeCaixa: double
        +RespostaCalcularIndicadores(saldo: double, economia: double, fluxoDeCaixa: double)
        +getSaldo() double
        +getEconomia() double
        +getFluxoDeCaixa() double
        +toString() String
    }
    class PedidoCompararPeriodos {
        <<dto>>
        +TIPO: String
        -periodos: List~Map~String,Object~~
        +PedidoCompararPeriodos()
        +PedidoCompararPeriodos(periodos: List~Map~String,Object~~)
        +getPeriodos() List
        +toString() String
    }
    class RespostaCompararPeriodos {
        <<dto>>
        +TIPO: String
        -periodos: List~Map~String,Object~~
        -tendenciaDespesas: String
        +RespostaCompararPeriodos(periodos: List~Map~String,Object~~, tendenciaDespesas: String)
        +getPeriodos() List
        +getTendenciaDespesas() String
        +toString() String
    }
    class GoalsHandler {
        <<handler>>
        -DIAS_POR_MES: double
        +registrarEm(HandlerRegistry registry) void
        +progressoMeta(Comunicado pedido) Comunicado
        +lerData(String texto, String nome) LocalDate$
        +arredondar(double valor) double$
    }
    class PedidoProgressoMeta {
        <<dto>>
        +TIPO: String
        -valorAtual: double
        -valorObjetivo: double
        -prazo: String
        -hoje: String
        +PedidoProgressoMeta()
        +PedidoProgressoMeta(double valorAtual, double valorObjetivo, String prazo, String hoje)
        +getValorAtual() double
        +getValorObjetivo() double
        +getPrazo() String
        +getHoje() String
        +toString() String
    }
    class RespostaProgressoMeta {
        <<dto>>
        +TIPO: String
        -percentual: double
        -falta: double
        -concluida: boolean
        -noPrazo: boolean
        -diasRestantes: int
        -mesesRestantes: int
        -aporteMensalNecessario: double
        +RespostaProgressoMeta(double percentual, double falta, boolean concluida, boolean noPrazo, int diasRestantes, int mesesRestantes, double aporteMensalNecessario)
        +getPercentual() double
        +getFalta() double
        +isConcluida() boolean
        +isNoPrazo() boolean
        +getDiasRestantes() int
        +getMesesRestantes() int
        +getAporteMensalNecessario() double
        +toString() String
    }
    class Comunicado
    class ErroDeNegocio
    class HandlerRegistry

    DashboardHandler ..> HandlerRegistry
    DashboardHandler ..> Comunicado
    DashboardHandler ..> ErroDeNegocio
    DashboardHandler ..> PedidoCalcularIndicadores
    DashboardHandler ..> PedidoCompararPeriodos
    DashboardHandler ..> RespostaCalcularIndicadores
    DashboardHandler ..> RespostaCompararPeriodos
    GoalsHandler ..> HandlerRegistry
    GoalsHandler ..> Comunicado
    GoalsHandler ..> ErroDeNegocio
    GoalsHandler ..> PedidoProgressoMeta
    GoalsHandler ..> RespostaProgressoMeta
```

```plantuml
@startuml
title Servidor — Painel e Metas (mensagens)
left to right direction
skinparam classAttributeIconSize 0

class DashboardHandler <<handler>> {
  -LIMITE_TENDENCIA: double
  +registrarEm(registry: HandlerRegistry): void
  -calcularIndicadores(pedido: Comunicado): Comunicado
  -compararPeriodos(pedido: Comunicado): Comunicado
  -variacao(anterior: double, atual: double): double
  -numero(mapa: Map, chave: String): double
}
class PedidoCalcularIndicadores <<dto>> {
  +TIPO: String
  -receitas: double
  -despesas: double
  +PedidoCalcularIndicadores()
  +PedidoCalcularIndicadores(receitas: double, despesas: double)
  +getReceitas(): double
  +getDespesas(): double
  +toString(): String
}
class RespostaCalcularIndicadores <<dto>> {
  +TIPO: String
  -saldo: double
  -economia: double
  -fluxoDeCaixa: double
  +RespostaCalcularIndicadores(saldo: double, economia: double, fluxoDeCaixa: double)
  +getSaldo(): double
  +getEconomia(): double
  +getFluxoDeCaixa(): double
  +toString(): String
}
class PedidoCompararPeriodos <<dto>> {
  +TIPO: String
  -periodos: List<Map<String,Object>>
  +PedidoCompararPeriodos()
  +PedidoCompararPeriodos(periodos: List<Map<String,Object>>)
  +getPeriodos(): List<Map<String,Object>>
  +toString(): String
}
class RespostaCompararPeriodos <<dto>> {
  +TIPO: String
  -periodos: List<Map<String,Object>>
  -tendenciaDespesas: String
  +RespostaCompararPeriodos(periodos: List<Map<String,Object>>, tendenciaDespesas: String)
  +getPeriodos(): List<Map<String,Object>>
  +getTendenciaDespesas(): String
  +toString(): String
}
class GoalsHandler <<handler>> {
  -DIAS_POR_MES: double
  +registrarEm(HandlerRegistry registry): void
  +progressoMeta(Comunicado pedido): Comunicado
  {static} +lerData(String texto, String nome): LocalDate
  {static} +arredondar(double valor): double
}
class PedidoProgressoMeta <<dto>> {
  +TIPO: String
  -valorAtual: double
  -valorObjetivo: double
  -prazo: String
  -hoje: String
  +PedidoProgressoMeta()
  +PedidoProgressoMeta(double valorAtual, double valorObjetivo, String prazo, String hoje)
  +getValorAtual(): double
  +getValorObjetivo(): double
  +getPrazo(): String
  +getHoje(): String
  +toString(): String
}
class RespostaProgressoMeta <<dto>> {
  +TIPO: String
  -percentual: double
  -falta: double
  -concluida: boolean
  -noPrazo: boolean
  -diasRestantes: int
  -mesesRestantes: int
  -aporteMensalNecessario: double
  +RespostaProgressoMeta(double percentual, double falta, boolean concluida, boolean noPrazo, int diasRestantes, int mesesRestantes, double aporteMensalNecessario)
  +getPercentual(): double
  +getFalta(): double
  +isConcluida(): boolean
  +isNoPrazo(): boolean
  +getDiasRestantes(): int
  +getMesesRestantes(): int
  +getAporteMensalNecessario(): double
  +toString(): String
}
class Comunicado
class ErroDeNegocio
class HandlerRegistry

DashboardHandler ..> HandlerRegistry
DashboardHandler ..> Comunicado
DashboardHandler ..> ErroDeNegocio
DashboardHandler ..> PedidoCalcularIndicadores
DashboardHandler ..> PedidoCompararPeriodos
DashboardHandler ..> RespostaCalcularIndicadores
DashboardHandler ..> RespostaCompararPeriodos
GoalsHandler ..> HandlerRegistry
GoalsHandler ..> Comunicado
GoalsHandler ..> ErroDeNegocio
GoalsHandler ..> PedidoProgressoMeta
GoalsHandler ..> RespostaProgressoMeta
@enduml
```

---

## 5. Servidor — Investimentos e cartão (mensagens)

Os itens de ativos e de parcelamentos trafegam como `List<Map<String,Object>>`; não existem classes internas de item no código. A rentabilidade simulada é uma feature futura na interface.

```mermaid
classDiagram
    direction LR
    class InvestmentsHandler {
        <<handler>>
        +registrarEm(registry: HandlerRegistry) void
        -rentabilidadeSimulada(pedido: Comunicado) Comunicado
        -calcularParcelamentos(pedido: Comunicado) Comunicado
        -numero(mapa: Map, chave: String, padrao: double) double
        -inteiro(mapa: Map, chave: String, padrao: int) int
        -arredondar(valor: double) double
    }
    class PedidoRentabilidadeSimulada {
        <<dto>>
        +TIPO: String
        -ativos: List~Map~String,Object~~
        -meses: Integer
        +PedidoRentabilidadeSimulada()
        +getAtivos() List
        +getMeses() Integer
        +toString() String
    }
    class RespostaRentabilidadeSimulada {
        <<dto>>
        +TIPO: String
        -ativos: List~Map~String,Object~~
        -totalInvestido: double
        -patrimonio: double
        -rendimento: double
        -rentabilidade: double
        +RespostaRentabilidadeSimulada(ativos: List~Map~String,Object~~, totalInvestido: double, patrimonio: double, rendimento: double, rentabilidade: double)
        +getAtivos() List
        +getTotalInvestido() double
        +getPatrimonio() double
        +getRendimento() double
        +getRentabilidade() double
        +toString() String
    }
    class PedidoCalcularParcelamentos {
        <<dto>>
        +TIPO: String
        -parcelamentos: List~Map~String,Object~~
        +PedidoCalcularParcelamentos()
        +getParcelamentos() List
        +toString() String
    }
    class RespostaCalcularParcelamentos {
        <<dto>>
        +TIPO: String
        -parcelamentos: List~Map~String,Object~~
        -totalParcelasDoMes: double
        -totalSaldoDevedor: double
        -totalJuros: double
        +RespostaCalcularParcelamentos(parcelamentos: List~Map~String,Object~~, totalParcelasDoMes: double, totalSaldoDevedor: double, totalJuros: double)
        +getParcelamentos() List
        +getTotalParcelasDoMes() double
        +getTotalSaldoDevedor() double
        +getTotalJuros() double
        +toString() String
    }
    class Comunicado
    class ErroDeNegocio
    class HandlerRegistry
    note for PedidoRentabilidadeSimulada "Rentabilidade e feature futura na interface."

    InvestmentsHandler ..> HandlerRegistry
    InvestmentsHandler ..> Comunicado
    InvestmentsHandler ..> ErroDeNegocio
    InvestmentsHandler ..> PedidoRentabilidadeSimulada
    InvestmentsHandler ..> PedidoCalcularParcelamentos
    InvestmentsHandler ..> RespostaRentabilidadeSimulada
    InvestmentsHandler ..> RespostaCalcularParcelamentos
```

```plantuml
@startuml
title Servidor — Investimentos e cartão (mensagens)
left to right direction
skinparam classAttributeIconSize 0

class InvestmentsHandler <<handler>> {
  +registrarEm(registry: HandlerRegistry): void
  -rentabilidadeSimulada(pedido: Comunicado): Comunicado
  -calcularParcelamentos(pedido: Comunicado): Comunicado
  -numero(mapa: Map, chave: String, padrao: double): double
  -inteiro(mapa: Map, chave: String, padrao: int): int
  -arredondar(valor: double): double
}
class PedidoRentabilidadeSimulada <<dto>> {
  +TIPO: String
  -ativos: List<Map<String,Object>>
  -meses: Integer
  +PedidoRentabilidadeSimulada()
  +getAtivos(): List<Map<String,Object>>
  +getMeses(): Integer
  +toString(): String
}
class RespostaRentabilidadeSimulada <<dto>> {
  +TIPO: String
  -ativos: List<Map<String,Object>>
  -totalInvestido: double
  -patrimonio: double
  -rendimento: double
  -rentabilidade: double
  +RespostaRentabilidadeSimulada(ativos: List<Map<String,Object>>, totalInvestido: double, patrimonio: double, rendimento: double, rentabilidade: double)
  +getAtivos(): List<Map<String,Object>>
  +getTotalInvestido(): double
  +getPatrimonio(): double
  +getRendimento(): double
  +getRentabilidade(): double
  +toString(): String
}
class PedidoCalcularParcelamentos <<dto>> {
  +TIPO: String
  -parcelamentos: List<Map<String,Object>>
  +PedidoCalcularParcelamentos()
  +getParcelamentos(): List<Map<String,Object>>
  +toString(): String
}
class RespostaCalcularParcelamentos <<dto>> {
  +TIPO: String
  -parcelamentos: List<Map<String,Object>>
  -totalParcelasDoMes: double
  -totalSaldoDevedor: double
  -totalJuros: double
  +RespostaCalcularParcelamentos(parcelamentos: List<Map<String,Object>>, totalParcelasDoMes: double, totalSaldoDevedor: double, totalJuros: double)
  +getParcelamentos(): List<Map<String,Object>>
  +getTotalParcelasDoMes(): double
  +getTotalSaldoDevedor(): double
  +getTotalJuros(): double
  +toString(): String
}
class Comunicado
class ErroDeNegocio
class HandlerRegistry
note right of PedidoRentabilidadeSimulada
  Rentabilidade e feature futura na interface.
end note

InvestmentsHandler ..> HandlerRegistry
InvestmentsHandler ..> Comunicado
InvestmentsHandler ..> ErroDeNegocio
InvestmentsHandler ..> PedidoRentabilidadeSimulada
InvestmentsHandler ..> PedidoCalcularParcelamentos
InvestmentsHandler ..> RespostaRentabilidadeSimulada
InvestmentsHandler ..> RespostaCalcularParcelamentos
@enduml
```

---

## 6. Servidor — Mentoria (contexto e filtro da IA)

`PedidoMontarContextoIA.Transacao` é classe aninhada (arquivo `PedidoMontarContextoIA.java`), ligada por composição ao pedido.

```mermaid
classDiagram
    direction LR
    class MentorHandler {
        <<handler>>
        -PT_BR: Locale
        -MAX_CATEGORIAS: int
        -MAIORES_DESPESAS: int
        -MAX_CARACTERES_DESCR: int
        +registrarEm(registry: HandlerRegistry) void
        -montarContexto(pedido: Comunicado) Comunicado
        -resumo(dia: int, receitas: double, despesas: double, porCategoria: Map~String,Double~, listaDespesas: List~Transacao~) String
        -filtrarResposta(pedido: Comunicado) Comunicado
        -descricao(t: Transacao) String
        -reais(valor: double) String
        -porcento(fracao: double) String
    }
    class FiltroDeAtivos {
        +AVISO: String
        -MINIMO_CARACTERES: int
        -TICKER: Pattern
        -NOME_DE_ATIVO: Pattern
        -RECOMENDACAO: Pattern
        -RECUSA: Pattern
        -CONJUNCAO_ADVERSATIVA: Pattern
        -SEPARADOR_DE_ORACAO: Pattern
        -FIM_DE_FRASE: Pattern
        +filtrar(resposta: String) String
        -recomendaAtivo(frase: String) boolean
        -temRecomendacaoForaDeRecusa(trecho: String) boolean
        -semAcento(texto: String) String
    }
    class FiltroDeEscopo {
        +MARCADOR: String
        +AVISO: String
        -BLOCO_DE_CODIGO: Pattern
        -LINHA_DE_CODIGO: Pattern
        -TRECHO_DE_CODIGO: Pattern
        +filtrar(resposta: String) String
        -foraDoEscopo(resposta: String) boolean
    }
    class PedidoMontarContextoIA {
        <<dto>>
        +TIPO: String
        -diaDoMes: int
        -transacoes: List~Transacao~
        +getDiaDoMes() int
        +getTransacoes() List
    }
    class PedidoMontarContextoIA_Transacao["PedidoMontarContextoIA.Transacao"] {
        -tipo: String
        -valor: double
        -categoria: String
        -descricao: String
        -data: String
        +getTipo() String
        +getValor() double
        +getCategoria() String
        +getDescricao() String
        +getData() String
    }
    class RespostaMontarContextoIA {
        <<dto>>
        +TIPO: String
        -contexto: String
        +RespostaMontarContextoIA(contexto: String)
        +getContexto() String
    }
    class PedidoFiltrarResposta {
        <<dto>>
        +TIPO: String
        -resposta: String
        +getResposta() String
    }
    class RespostaFiltrarResposta {
        <<dto>>
        +TIPO: String
        -respostaFiltrada: String
        +RespostaFiltrarResposta(respostaFiltrada: String)
        +getRespostaFiltrada() String
    }
    class Comunicado
    class ErroDeNegocio
    class HandlerRegistry

    PedidoMontarContextoIA "1" *-- "*" PedidoMontarContextoIA_Transacao : transacoes
    MentorHandler ..> HandlerRegistry
    MentorHandler ..> Comunicado
    MentorHandler ..> ErroDeNegocio
    MentorHandler ..> PedidoMontarContextoIA
    MentorHandler ..> PedidoMontarContextoIA_Transacao
    MentorHandler ..> RespostaMontarContextoIA
    MentorHandler ..> PedidoFiltrarResposta
    MentorHandler ..> RespostaFiltrarResposta
    MentorHandler ..> FiltroDeAtivos
    MentorHandler ..> FiltroDeEscopo
```

```plantuml
@startuml
title Servidor — Mentoria (contexto e filtro da IA)
left to right direction
skinparam classAttributeIconSize 0

class MentorHandler <<handler>> {
  -PT_BR: Locale
  -MAX_CATEGORIAS: int
  -MAIORES_DESPESAS: int
  -MAX_CARACTERES_DESCR: int
  +registrarEm(registry: HandlerRegistry): void
  -montarContexto(pedido: Comunicado): Comunicado
  -resumo(dia: int, receitas: double, despesas: double, porCategoria: Map<String,Double>, listaDespesas: List<Transacao>): String
  -filtrarResposta(pedido: Comunicado): Comunicado
  -descricao(t: Transacao): String
  -reais(valor: double): String
  -porcento(fracao: double): String
}
class FiltroDeAtivos {
  +AVISO: String
  -MINIMO_CARACTERES: int
  -TICKER: Pattern
  -NOME_DE_ATIVO: Pattern
  -RECOMENDACAO: Pattern
  -RECUSA: Pattern
  -CONJUNCAO_ADVERSATIVA: Pattern
  -SEPARADOR_DE_ORACAO: Pattern
  -FIM_DE_FRASE: Pattern
  +filtrar(resposta: String): String
  -recomendaAtivo(frase: String): boolean
  -temRecomendacaoForaDeRecusa(trecho: String): boolean
  -semAcento(texto: String): String
}
class FiltroDeEscopo {
  +MARCADOR: String
  +AVISO: String
  -BLOCO_DE_CODIGO: Pattern
  -LINHA_DE_CODIGO: Pattern
  -TRECHO_DE_CODIGO: Pattern
  +filtrar(resposta: String): String
  -foraDoEscopo(resposta: String): boolean
}
class PedidoMontarContextoIA <<dto>> {
  +TIPO: String
  -diaDoMes: int
  -transacoes: List<Transacao>
  +getDiaDoMes(): int
  +getTransacoes(): List<Transacao>
}
class "PedidoMontarContextoIA.Transacao" as PedidoMontarContextoIA_Transacao {
  -tipo: String
  -valor: double
  -categoria: String
  -descricao: String
  -data: String
  +getTipo(): String
  +getValor(): double
  +getCategoria(): String
  +getDescricao(): String
  +getData(): String
}
class RespostaMontarContextoIA <<dto>> {
  +TIPO: String
  -contexto: String
  +RespostaMontarContextoIA(contexto: String)
  +getContexto(): String
}
class PedidoFiltrarResposta <<dto>> {
  +TIPO: String
  -resposta: String
  +getResposta(): String
}
class RespostaFiltrarResposta <<dto>> {
  +TIPO: String
  -respostaFiltrada: String
  +RespostaFiltrarResposta(respostaFiltrada: String)
  +getRespostaFiltrada(): String
}
class Comunicado
class ErroDeNegocio
class HandlerRegistry

PedidoMontarContextoIA "1" *-- "*" PedidoMontarContextoIA_Transacao : transacoes
MentorHandler ..> HandlerRegistry
MentorHandler ..> Comunicado
MentorHandler ..> ErroDeNegocio
MentorHandler ..> PedidoMontarContextoIA
MentorHandler ..> PedidoMontarContextoIA_Transacao
MentorHandler ..> RespostaMontarContextoIA
MentorHandler ..> PedidoFiltrarResposta
MentorHandler ..> RespostaFiltrarResposta
MentorHandler ..> FiltroDeAtivos
MentorHandler ..> FiltroDeEscopo
@enduml
```
