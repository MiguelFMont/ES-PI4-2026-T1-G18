# Modelo UML: Frontend, investments (cartões)

Grupo: `fe-investments`. Origem: `Frontend/src/features/investments/`.

Notação: padrão Astah / UML 2. Visibilidade: `+` público, `-` privado, `#` protegido, `~` pacote. Todos os elementos deste grupo são módulos JavaScript («module»); não há classes nem interfaces. Nenhum elemento «planejado» pertence a este grupo: a tela de Cartão de crédito já existe no código. Nos módulos, "público" significa exportado (`export`) e "privado" significa interno ao arquivo.

Vizinhos externos ao grupo (fora de `investments`): `includes.js` (`incluirFragmentos`), `api.js` (`apiFetch`), `notificacao.js` (`notificar`, `confirmar`), `campos.js` (`aplicarMascaraMoeda`, `ligarCampo`), `moeda.js` (`formatarData`, `formatarMoeda`, `valorParaCampo`, `lerValor`), `transactionsService.js` (`listarTransacoes`), `constants.js (transactions)` (`CATEGORIAS`, `rotuloDe`) e o Backend `/investments/cards`.

## Diagrama do grupo

```mermaid
classDiagram
    class IndexJs["investments/index.js"] {
        <<module>>
        -AbortController|null controlador
        +montar(container) Promise~void~
        +desmontar() void
    }
    class InvestmentsPageJs["InvestmentsPage.js"] {
        <<module>>
        +iniciarPaginaCartao(raiz, opcoes) void
    }
    class CartaoComprasJs["CartaoCompras.js"] {
        <<module>>
        -number POR_VEZ
        +iniciarCompras(raiz, opcoes) ControleCompras
    }
    class CartaoFormJs["CartaoForm.js"] {
        <<module>>
        -number LIMITE_PADRAO
        -number DIA_PADRAO
        -Record MENSAGENS
        -Record CAMPO_DA_API
        +iniciarCartaoForm(raiz, opcoes) ControleForm
    }
    class CartoesListaJs["CartoesLista.js"] {
        <<module>>
        -Intl.DateTimeFormat MES_EM_TEXTO
        +iniciarCartoes(raiz, opcoes) ControleLista
    }
    class InvestmentsServiceJs["investmentsService.js"] {
        <<module>>
        +listarCartoes() Promise
        +criarCartao(dados) Promise~Card~
        +atualizarCartao(id, alteracoes) Promise~Card~
        +excluirCartao(id) Promise~void~
    }
    class ConstantsJs["constants.js (investments)"] {
        <<module>>
        +number MAX_CARTOES
        +Record MENSAGENS_DE_ERRO
        +mensagemDeErro(erro, padrao) string
        +lerInteiro(texto) number
    }
    class IncludesJs["includes.js"] {
        <<module>>
    }
    class ApiJs["api.js"] {
        <<module>>
    }
    class NotificacaoJs["notificacao.js"] {
        <<module>>
    }
    class CamposJs["campos.js"] {
        <<module>>
    }
    class MoedaJs["moeda.js"] {
        <<module>>
    }
    class TransactionsServiceJs["transactionsService.js"] {
        <<module>>
    }
    class ConstantsTransJs["constants.js (transactions)"] {
        <<module>>
    }
    class BackendCards["Backend /investments/cards"] {
        <<controller>>
    }
    IndexJs ..> IncludesJs : incluirFragmentos
    IndexJs ..> InvestmentsPageJs : iniciarPaginaCartao
    InvestmentsPageJs ..> InvestmentsServiceJs
    InvestmentsPageJs ..> ConstantsJs : mensagemDeErro
    InvestmentsPageJs ..> CartoesListaJs : iniciarCartoes
    InvestmentsPageJs ..> CartaoFormJs : iniciarCartaoForm
    InvestmentsPageJs ..> CartaoComprasJs : iniciarCompras
    InvestmentsPageJs ..> NotificacaoJs : notificar, confirmar
    CartaoComprasJs ..> TransactionsServiceJs : listarTransacoes
    CartaoComprasJs ..> ConstantsTransJs : CATEGORIAS, rotuloDe
    CartaoComprasJs ..> MoedaJs : formatarData, formatarMoeda
    CartaoComprasJs ..> ConstantsJs : mensagemDeErro
    CartaoFormJs ..> CamposJs : aplicarMascaraMoeda, ligarCampo
    CartaoFormJs ..> MoedaJs : valorParaCampo, lerValor
    CartaoFormJs ..> ConstantsJs : lerInteiro
    CartoesListaJs ..> MoedaJs : formatarData, formatarMoeda
    CartoesListaJs ..> ConstantsJs : MAX_CARTOES
    InvestmentsServiceJs ..> ApiJs : apiFetch
    InvestmentsServiceJs ..> BackendCards : HTTP
```

```plantuml
@startuml
skinparam classAttributeIconSize 0

class "investments/index.js" as IndexJs <<module>> {
  - controlador: AbortController|null
  + montar(container): Promise<void>
  + desmontar(): void
}
class "InvestmentsPage.js" as InvestmentsPageJs <<module>> {
  + iniciarPaginaCartao(raiz, opcoes): void
}
class "CartaoCompras.js" as CartaoComprasJs <<module>> {
  - POR_VEZ: number
  + iniciarCompras(raiz, opcoes): ControleCompras
}
class "CartaoForm.js" as CartaoFormJs <<module>> {
  - LIMITE_PADRAO: number
  - DIA_PADRAO: number
  - MENSAGENS: Record<string,string>
  - CAMPO_DA_API: Record<string,string>
  + iniciarCartaoForm(raiz, opcoes): ControleForm
}
class "CartoesLista.js" as CartoesListaJs <<module>> {
  - MES_EM_TEXTO: Intl.DateTimeFormat
  + iniciarCartoes(raiz, opcoes): ControleLista
}
class "investmentsService.js" as InvestmentsServiceJs <<module>> {
  + listarCartoes(): Promise<{cartoes: Card[]}>
  + criarCartao(dados): Promise<Card>
  + atualizarCartao(id, alteracoes): Promise<Card>
  + excluirCartao(id): Promise<void>
}
class "constants.js (investments)" as ConstantsJs <<module>> {
  + MAX_CARTOES: number
  + MENSAGENS_DE_ERRO: Record<string,string>
  + mensagemDeErro(erro, padrao): string
  + lerInteiro(texto): number
}
class "includes.js" as IncludesJs <<module>>
class "api.js" as ApiJs <<module>>
class "notificacao.js" as NotificacaoJs <<module>>
class "campos.js" as CamposJs <<module>>
class "moeda.js" as MoedaJs <<module>>
class "transactionsService.js" as TransactionsServiceJs <<module>>
class "constants.js (transactions)" as ConstantsTransJs <<module>>
class "Backend /investments/cards" as BackendCards <<controller>>

IndexJs ..> IncludesJs : incluirFragmentos
IndexJs ..> InvestmentsPageJs : iniciarPaginaCartao
InvestmentsPageJs ..> InvestmentsServiceJs
InvestmentsPageJs ..> ConstantsJs : mensagemDeErro
InvestmentsPageJs ..> CartoesListaJs : iniciarCartoes
InvestmentsPageJs ..> CartaoFormJs : iniciarCartaoForm
InvestmentsPageJs ..> CartaoComprasJs : iniciarCompras
InvestmentsPageJs ..> NotificacaoJs : notificar, confirmar
CartaoComprasJs ..> TransactionsServiceJs : listarTransacoes
CartaoComprasJs ..> ConstantsTransJs : CATEGORIAS, rotuloDe
CartaoComprasJs ..> MoedaJs : formatarData, formatarMoeda
CartaoComprasJs ..> ConstantsJs : mensagemDeErro
CartaoFormJs ..> CamposJs : aplicarMascaraMoeda, ligarCampo
CartaoFormJs ..> MoedaJs : valorParaCampo, lerValor
CartaoFormJs ..> ConstantsJs : lerInteiro
CartoesListaJs ..> MoedaJs : formatarData, formatarMoeda
CartoesListaJs ..> ConstantsJs : MAX_CARTOES
InvestmentsServiceJs ..> ApiJs : apiFetch
InvestmentsServiceJs ..> BackendCards : HTTP
@enduml
```

---

## investments/index.js

- **Tipo e estereótipo:** módulo, «module»
- **Arquivo de origem:** `Frontend/src/features/investments/index.js`
- **Descrição:** ponto de entrada da tela de Cartão de crédito. O roteador entrega o HTML de `views/investments.html` já no container; `montar` junta os fragmentos de componentes e liga `InvestmentsPage`. `desmontar` aborta o controlador, o que remove os ouvintes e descarta respostas pendentes.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | controlador | AbortController\|null | Um controlador por montagem; o `abort()` desliga tudo o que a tela ligou. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | montar(container) | Promise\<void\> | Inclui os fragmentos HTML, cria o controlador e chama `iniciarPaginaCartao`. |
| + | desmontar() | void | Aborta o controlador e o zera. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | includes.js | 1 | incluirFragmentos |
| dependência | InvestmentsPage.js | 1 | iniciarPaginaCartao |

```mermaid
classDiagram
    class IndexJs["investments/index.js"] {
        <<module>>
        -AbortController|null controlador
        +montar(container) Promise~void~
        +desmontar() void
    }
    class IncludesJs["includes.js"] { <<module>> }
    class InvestmentsPageJs["InvestmentsPage.js"] { <<module>> }
    IndexJs ..> IncludesJs : incluirFragmentos
    IndexJs ..> InvestmentsPageJs : iniciarPaginaCartao
```

```plantuml
@startuml
skinparam classAttributeIconSize 0
class "investments/index.js" as IndexJs <<module>> {
  - controlador: AbortController|null
  + montar(container): Promise<void>
  + desmontar(): void
}
class "includes.js" as IncludesJs <<module>>
class "InvestmentsPage.js" as InvestmentsPageJs <<module>>
IndexJs ..> IncludesJs : incluirFragmentos
IndexJs ..> InvestmentsPageJs : iniciarPaginaCartao
@enduml
```

---

## InvestmentsPage.js

- **Tipo e estereótipo:** módulo, «module»
- **Arquivo de origem:** `Frontend/src/features/investments/components/InvestmentsPage/InvestmentsPage.js`
- **Descrição:** coordena a página de Cartões: carrega os cartões, cria, edita, exclui e escolhe o cartão cujas compras são exibidas. Mantém o estado local (`sequencia`, `cartaoId`) e descarta respostas antigas.

### Atributos

Nenhum atributo exportado. Internamente usa o objeto de estado `estado { sequencia, cartaoId }` e a lista `lista` de cartões carregados (variáveis locais da função).

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | estado | { sequencia: number, cartaoId: string\|null } | Contador para ignorar respostas antigas e id do cartão escolhido (null = o primeiro). |
| - | lista | Card[] | Cartões carregados. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarPaginaCartao(raiz, { signal }) | void | Liga a página ao HTML de `views/investments.html`, cria os componentes e dispara o primeiro carregamento. |
| - | mostrarEscolhido() | void | Marca o card escolhido e mostra as compras dele. |
| - | carregar({ silencioso }) | Promise\<void\> | Busca os cartões e controla os estados carregando, erro e conteúdo. |
| - | agir(chamada, sucesso, falha, aoConcluir) | Promise\<void\> | Executa uma chamada, notifica o resultado e recarrega a tela em silêncio. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | investmentsService.js | 1 | listarCartoes, criarCartao, atualizarCartao, excluirCartao |
| dependência | constants.js (investments) | 1 | mensagemDeErro |
| dependência | CartoesLista.js | 1 | iniciarCartoes |
| dependência | CartaoForm.js | 1 | iniciarCartaoForm |
| dependência | CartaoCompras.js | 1 | iniciarCompras |
| dependência | notificacao.js | 1 | notificar, confirmar |

```mermaid
classDiagram
    class InvestmentsPageJs["InvestmentsPage.js"] {
        <<module>>
        -Object estado
        -Card[] lista
        +iniciarPaginaCartao(raiz, opcoes) void
        -mostrarEscolhido() void
        -carregar(opcoes) Promise~void~
        -agir(chamada, sucesso, falha, aoConcluir) Promise~void~
    }
    class InvestmentsServiceJs["investmentsService.js"] { <<module>> }
    class ConstantsJs["constants.js (investments)"] { <<module>> }
    class CartoesListaJs["CartoesLista.js"] { <<module>> }
    class CartaoFormJs["CartaoForm.js"] { <<module>> }
    class CartaoComprasJs["CartaoCompras.js"] { <<module>> }
    class NotificacaoJs["notificacao.js"] { <<module>> }
    InvestmentsPageJs ..> InvestmentsServiceJs
    InvestmentsPageJs ..> ConstantsJs : mensagemDeErro
    InvestmentsPageJs ..> CartoesListaJs : iniciarCartoes
    InvestmentsPageJs ..> CartaoFormJs : iniciarCartaoForm
    InvestmentsPageJs ..> CartaoComprasJs : iniciarCompras
    InvestmentsPageJs ..> NotificacaoJs : notificar, confirmar
```

```plantuml
@startuml
skinparam classAttributeIconSize 0
class "InvestmentsPage.js" as InvestmentsPageJs <<module>> {
  - estado: Object
  - lista: Card[]
  + iniciarPaginaCartao(raiz, opcoes): void
  - mostrarEscolhido(): void
  - carregar(opcoes): Promise<void>
  - agir(chamada, sucesso, falha, aoConcluir): Promise<void>
}
class "investmentsService.js" as InvestmentsServiceJs <<module>>
class "constants.js (investments)" as ConstantsJs <<module>>
class "CartoesLista.js" as CartoesListaJs <<module>>
class "CartaoForm.js" as CartaoFormJs <<module>>
class "CartaoCompras.js" as CartaoComprasJs <<module>>
class "notificacao.js" as NotificacaoJs <<module>>
InvestmentsPageJs ..> InvestmentsServiceJs
InvestmentsPageJs ..> ConstantsJs : mensagemDeErro
InvestmentsPageJs ..> CartoesListaJs : iniciarCartoes
InvestmentsPageJs ..> CartaoFormJs : iniciarCartaoForm
InvestmentsPageJs ..> CartaoComprasJs : iniciarCompras
InvestmentsPageJs ..> NotificacaoJs : notificar, confirmar
@enduml
```

---

## CartaoCompras.js

- **Tipo e estereótipo:** módulo, «module»
- **Arquivo de origem:** `Frontend/src/features/investments/components/CartaoCompras/CartaoCompras.js` (par `CartaoCompras.html` e CSS)
- **Descrição:** tabela das compras no crédito do cartão escolhido, buscadas em transações.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | POR_VEZ | number | Quantidade de compras exibidas por vez. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarCompras(raiz, { signal }) | { mostrar, esconder } | Liga o componente e devolve o controle para mostrar as compras de um cartão ou escondê-las. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | transactionsService.js | 1 | listarTransacoes |
| dependência | constants.js (transactions) | 1 | CATEGORIAS, rotuloDe |
| dependência | moeda.js | 1 | formatarData, formatarMoeda |
| dependência | constants.js (investments) | 1 | mensagemDeErro |

```mermaid
classDiagram
    class CartaoComprasJs["CartaoCompras.js"] {
        <<module>>
        -number POR_VEZ
        +iniciarCompras(raiz, opcoes) ControleCompras
    }
    class TransactionsServiceJs["transactionsService.js"] { <<module>> }
    class ConstantsTransJs["constants.js (transactions)"] { <<module>> }
    class MoedaJs["moeda.js"] { <<module>> }
    class ConstantsJs["constants.js (investments)"] { <<module>> }
    CartaoComprasJs ..> TransactionsServiceJs : listarTransacoes
    CartaoComprasJs ..> ConstantsTransJs : CATEGORIAS, rotuloDe
    CartaoComprasJs ..> MoedaJs : formatarData, formatarMoeda
    CartaoComprasJs ..> ConstantsJs : mensagemDeErro
```

```plantuml
@startuml
skinparam classAttributeIconSize 0
class "CartaoCompras.js" as CartaoComprasJs <<module>> {
  - POR_VEZ: number
  + iniciarCompras(raiz, opcoes): ControleCompras
}
class "transactionsService.js" as TransactionsServiceJs <<module>>
class "constants.js (transactions)" as ConstantsTransJs <<module>>
class "moeda.js" as MoedaJs <<module>>
class "constants.js (investments)" as ConstantsJs <<module>>
CartaoComprasJs ..> TransactionsServiceJs : listarTransacoes
CartaoComprasJs ..> ConstantsTransJs : CATEGORIAS, rotuloDe
CartaoComprasJs ..> MoedaJs : formatarData, formatarMoeda
CartaoComprasJs ..> ConstantsJs : mensagemDeErro
@enduml
```

---

## CartaoForm.js

- **Tipo e estereótipo:** módulo, «module»
- **Arquivo de origem:** `Frontend/src/features/investments/components/CartaoForm/CartaoForm.js` (par `CartaoForm.html` e CSS)
- **Descrição:** formulário de cartão para criar ou editar nome, limite e dia de fechamento, com validação.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | LIMITE_PADRAO | number | Limite sugerido para um cartão novo. |
| - | DIA_PADRAO | number | Dia de fechamento sugerido para um cartão novo. |
| - | MENSAGENS | Record\<string,string\> | Textos de erro de validação dos campos. |
| - | CAMPO_DA_API | Record\<string,string\> | Correspondência entre campos da API e campos do formulário, para exibir erros de campo. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarCartaoForm(raiz, { signal, salvar }) | { abrirNovo, abrirEditar, fechar } | Liga o formulário; `salvar` é a função fornecida pela página para persistir os dados. Devolve o controle para abrir em modo novo, abrir em modo edição e fechar. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | campos.js | 1 | aplicarMascaraMoeda, ligarCampo |
| dependência | moeda.js | 1 | valorParaCampo, lerValor |
| dependência | constants.js (investments) | 1 | lerInteiro |

```mermaid
classDiagram
    class CartaoFormJs["CartaoForm.js"] {
        <<module>>
        -number LIMITE_PADRAO
        -number DIA_PADRAO
        -Record MENSAGENS
        -Record CAMPO_DA_API
        +iniciarCartaoForm(raiz, opcoes) ControleForm
    }
    class CamposJs["campos.js"] { <<module>> }
    class MoedaJs["moeda.js"] { <<module>> }
    class ConstantsJs["constants.js (investments)"] { <<module>> }
    CartaoFormJs ..> CamposJs : aplicarMascaraMoeda, ligarCampo
    CartaoFormJs ..> MoedaJs : valorParaCampo, lerValor
    CartaoFormJs ..> ConstantsJs : lerInteiro
```

```plantuml
@startuml
skinparam classAttributeIconSize 0
class "CartaoForm.js" as CartaoFormJs <<module>> {
  - LIMITE_PADRAO: number
  - DIA_PADRAO: number
  - MENSAGENS: Record<string,string>
  - CAMPO_DA_API: Record<string,string>
  + iniciarCartaoForm(raiz, opcoes): ControleForm
}
class "campos.js" as CamposJs <<module>>
class "moeda.js" as MoedaJs <<module>>
class "constants.js (investments)" as ConstantsJs <<module>>
CartaoFormJs ..> CamposJs : aplicarMascaraMoeda, ligarCampo
CartaoFormJs ..> MoedaJs : valorParaCampo, lerValor
CartaoFormJs ..> ConstantsJs : lerInteiro
@enduml
```

---

## CartoesLista.js

- **Tipo e estereótipo:** módulo, «module»
- **Arquivo de origem:** `Frontend/src/features/investments/components/CartoesLista/CartoesLista.js` (par `CartoesLista.html` e CSS)
- **Descrição:** lista de cards de cartões com fatura, limite, barra de uso e as ações selecionar, editar, excluir e novo.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | MES_EM_TEXTO | Intl.DateTimeFormat | Formatador do mês em texto, usado na exibição da fatura. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarCartoes(raiz, { signal, selecionar, editar, excluir, novo }) | { mostrar } | Liga a lista e registra os callbacks de ação; `mostrar(lista, escolhidoId)` desenha os cards e marca o escolhido. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | moeda.js | 1 | formatarData, formatarMoeda |
| dependência | constants.js (investments) | 1 | MAX_CARTOES |

```mermaid
classDiagram
    class CartoesListaJs["CartoesLista.js"] {
        <<module>>
        -Intl.DateTimeFormat MES_EM_TEXTO
        +iniciarCartoes(raiz, opcoes) ControleLista
    }
    class MoedaJs["moeda.js"] { <<module>> }
    class ConstantsJs["constants.js (investments)"] { <<module>> }
    CartoesListaJs ..> MoedaJs : formatarData, formatarMoeda
    CartoesListaJs ..> ConstantsJs : MAX_CARTOES
```

```plantuml
@startuml
skinparam classAttributeIconSize 0
class "CartoesLista.js" as CartoesListaJs <<module>> {
  - MES_EM_TEXTO: Intl.DateTimeFormat
  + iniciarCartoes(raiz, opcoes): ControleLista
}
class "moeda.js" as MoedaJs <<module>>
class "constants.js (investments)" as ConstantsJs <<module>>
CartoesListaJs ..> MoedaJs : formatarData, formatarMoeda
CartoesListaJs ..> ConstantsJs : MAX_CARTOES
@enduml
```

---

## investmentsService.js

- **Tipo e estereótipo:** módulo, «module» (papel de serviço de acesso ao Backend)
- **Arquivo de origem:** `Frontend/src/features/investments/services/investmentsService.js`
- **Descrição:** chamadas ao Backend em `/investments/cards` (listar, criar, atualizar e excluir cartões simulados). Fatura, valor atual e demais cálculos já chegam prontos do Backend.

### Atributos

Nenhum.

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | listarCartoes() | Promise\<{cartoes: Card[]}\> | `GET /investments/cards`: cartões do usuário, o mais antigo (o padrão) primeiro, cada um com a sua fatura. |
| + | criarCartao(dados) | Promise\<Card\> | `POST /investments/cards` com `{ nome, limite?, diaFechamento? }`. |
| + | atualizarCartao(id, alteracoes) | Promise\<Card\> | `PATCH /investments/cards/:id`: altera nome, limite e/ou dia de fechamento; devolve o cartão recalculado. |
| + | excluirCartao(id) | Promise\<void\> | `DELETE /investments/cards/:id`: as transações do cartão ficam, sem o vínculo (resposta 204). |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | api.js | 1 | apiFetch |
| dependência | Backend /investments/cards | 1 | HTTP |

```mermaid
classDiagram
    class InvestmentsServiceJs["investmentsService.js"] {
        <<module>>
        +listarCartoes() Promise
        +criarCartao(dados) Promise~Card~
        +atualizarCartao(id, alteracoes) Promise~Card~
        +excluirCartao(id) Promise~void~
    }
    class ApiJs["api.js"] { <<module>> }
    class BackendCards["Backend /investments/cards"] { <<controller>> }
    InvestmentsServiceJs ..> ApiJs : apiFetch
    InvestmentsServiceJs ..> BackendCards : HTTP
```

```plantuml
@startuml
skinparam classAttributeIconSize 0
class "investmentsService.js" as InvestmentsServiceJs <<module>> {
  + listarCartoes(): Promise<{cartoes: Card[]}>
  + criarCartao(dados): Promise<Card>
  + atualizarCartao(id, alteracoes): Promise<Card>
  + excluirCartao(id): Promise<void>
}
class "api.js" as ApiJs <<module>>
class "Backend /investments/cards" as BackendCards <<controller>>
InvestmentsServiceJs ..> ApiJs : apiFetch
InvestmentsServiceJs ..> BackendCards : HTTP
@enduml
```

---

## constants.js (investments)

- **Tipo e estereótipo:** módulo, «module»
- **Arquivo de origem:** `Frontend/src/features/investments/utils/constants.js`
- **Descrição:** limite de cartões, mensagens de erro da API (códigos como `CARD_NOT_FOUND`, `CARD_LIMIT_REACHED`, `CARD_NAME_TAKEN`, `CARD_HAS_INSTALLMENTS`, `INSTALLMENT_FROM_TRANSACTION`, `INSTALLMENT_NOT_FOUND`, `JAVA_SERVER_UNAVAILABLE`) e leitura de inteiros.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| + | MAX_CARTOES | number | Máximo de cartões por usuário (5); o Backend recusa o sexto com `CARD_LIMIT_REACHED`. |
| + | MENSAGENS_DE_ERRO | Record\<string,string\> | Texto para o usuário de cada código de erro conhecido da API. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | mensagemDeErro(erro, padrao) | string | Devolve o texto do código do erro, senão a mensagem da própria API, senão `padrao`. |
| + | lerInteiro(texto) | number | Converte "12" em 12; devolve `NaN` se não for inteiro (zero vale). |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência (usado por) | InvestmentsPage.js | * | mensagemDeErro |
| dependência (usado por) | CartaoCompras.js | * | mensagemDeErro |
| dependência (usado por) | CartaoForm.js | * | lerInteiro |
| dependência (usado por) | CartoesLista.js | * | MAX_CARTOES |

```mermaid
classDiagram
    class ConstantsJs["constants.js (investments)"] {
        <<module>>
        +number MAX_CARTOES
        +Record MENSAGENS_DE_ERRO
        +mensagemDeErro(erro, padrao) string
        +lerInteiro(texto) number
    }
    class InvestmentsPageJs["InvestmentsPage.js"] { <<module>> }
    class CartaoComprasJs["CartaoCompras.js"] { <<module>> }
    class CartaoFormJs["CartaoForm.js"] { <<module>> }
    class CartoesListaJs["CartoesLista.js"] { <<module>> }
    InvestmentsPageJs ..> ConstantsJs : mensagemDeErro
    CartaoComprasJs ..> ConstantsJs : mensagemDeErro
    CartaoFormJs ..> ConstantsJs : lerInteiro
    CartoesListaJs ..> ConstantsJs : MAX_CARTOES
```

```plantuml
@startuml
skinparam classAttributeIconSize 0
class "constants.js (investments)" as ConstantsJs <<module>> {
  + MAX_CARTOES: number
  + MENSAGENS_DE_ERRO: Record<string,string>
  + mensagemDeErro(erro, padrao): string
  + lerInteiro(texto): number
}
class "InvestmentsPage.js" as InvestmentsPageJs <<module>>
class "CartaoCompras.js" as CartaoComprasJs <<module>>
class "CartaoForm.js" as CartaoFormJs <<module>>
class "CartoesLista.js" as CartoesListaJs <<module>>
InvestmentsPageJs ..> ConstantsJs : mensagemDeErro
CartaoComprasJs ..> ConstantsJs : mensagemDeErro
CartaoFormJs ..> ConstantsJs : lerInteiro
CartoesListaJs ..> ConstantsJs : MAX_CARTOES
@enduml
```
