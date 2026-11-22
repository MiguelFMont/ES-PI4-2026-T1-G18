# Frontend: mentor-ia — Modelo UML das classes e módulos

Grupo `fe-mentor-ia`: módulos da tela do Mentor IA no Frontend (`Frontend/src/features/mentor-ia`). Todos os elementos são módulos JavaScript (ES modules) com estereótipo «módulo»; as "operações" são funções exportadas (`+`) ou internas (`-`) e os "atributos" são constantes ou variáveis do módulo. Notação Astah / UML 2.

Observações de notação:
- Nos diagramas, os módulos usam identificadores sem ponto (ex.: `MentorPage`), com o nome do arquivo no rótulo.
- Os parâmetros por desestruturação (`{ signal }`) aparecem abreviados como `opcoes` nos diagramas e completos nas tabelas.
- Vizinhos fora do grupo (`includes.js`, `api.js`, `notificacao.js`, Backend `/mentor-ia`) aparecem apenas como alvos de dependência.

## Diagrama do grupo

```mermaid
classDiagram
    direction LR
    class MentorIaIndex["mentor-ia/index.js"] {
        <<module>>
        -controlador: AbortController
        +montar(container) Promise~void~
        +desmontar() void
    }
    class MentorPage["MentorPage.js"] {
        <<module>>
        -MENSAGENS_DE_ERRO: Record
        -ESPERA_PARA_MOSTRAR_PENSANDO_MS: number
        +iniciarPaginaMentor(raiz, opcoes) void
        -mensagemDeErro(erro) string
    }
    class MentorAlertas["MentorAlertas.js"] {
        <<module>>
        -NOMES_DOS_TIPOS: Record
        +iniciarAlertas(raiz, opcoes) Controle
    }
    class MentorConversa["MentorConversa.js"] {
        <<module>>
        +iniciarConversa(raiz, opcoes) Controle
        -preencherHorario(item, iso) void
        -montarMensagem(modelo, mensagem) HTMLElement
    }
    class MentorEntrada["MentorEntrada.js"] {
        <<module>>
        -ALTURA_MAXIMA_PX: number
        +iniciarEntrada(raiz, opcoes) Controle
    }
    class MentorIaService["mentorIaService.js"] {
        <<module>>
        +buscarHistorico(opcoes) Promise~Mensagem[]~
        +enviarMensagem(texto) Promise~PerguntaResposta~
        +buscarExplicacaoProativa(opcoes) Promise~Mensagens~
        +buscarAlertas(opcoes) Promise~Alerta[]~
        +marcarAlertaComoLido(id) Promise~Alerta~
    }
    class FormatMentor["format.js (mentor-ia)"] {
        <<module>>
        -hora: Intl.DateTimeFormat
        -diaEHora: Intl.DateTimeFormat
        +formatarHorario(iso) string
    }
    class Markdown["markdown.js"] {
        <<module>>
        -ITEM_DE_LISTA: RegExp
        -ITEM_NUMERADO: RegExp
        +markdownParaElementos(texto) DocumentFragment
        -preencherLinha(destino, linha) void
    }
    class Includes["includes.js"] {
        <<module>>
    }
    class Api["api.js"] {
        <<module>>
    }
    class Notificacao["notificacao.js"] {
        <<module>>
    }
    class BackendMentorIa["Backend /mentor-ia"] {
        <<controller>>
    }
    MentorIaIndex ..> Includes : incluirFragmentos
    MentorIaIndex ..> MentorPage : iniciarPaginaMentor
    MentorPage ..> MentorIaService
    MentorPage ..> MentorAlertas : iniciarAlertas
    MentorPage ..> MentorConversa : iniciarConversa
    MentorPage ..> MentorEntrada : iniciarEntrada
    MentorPage ..> Notificacao : notificar
    MentorConversa ..> FormatMentor : formatarHorario
    MentorConversa ..> Markdown : markdownParaElementos
    MentorIaService ..> Api : apiFetch
    MentorIaService ..> BackendMentorIa : HTTP
```

```plantuml
@startuml
left to right direction
class "mentor-ia/index.js" as MentorIaIndex <<module>> {
  - controlador: AbortController|null
  + montar(container): Promise<void>
  + desmontar(): void
}
class "MentorPage.js" as MentorPage <<module>> {
  - MENSAGENS_DE_ERRO: Record<string,string>
  - ESPERA_PARA_MOSTRAR_PENSANDO_MS: number
  + iniciarPaginaMentor(raiz, { signal }): void
  - mensagemDeErro(erro): string
}
class "MentorAlertas.js" as MentorAlertas <<module>> {
  - NOMES_DOS_TIPOS: Record<string,string>
  + iniciarAlertas(raiz, { entender, aoEsvaziar, signal }): { mostrar }
}
class "MentorConversa.js" as MentorConversa <<module>> {
  + iniciarConversa(raiz, { tentarNovamente, escolherSugestao }): Controle
  - preencherHorario(item, iso): void
  - montarMensagem(modelo, mensagem): HTMLElement
}
class "MentorEntrada.js" as MentorEntrada <<module>> {
  - ALTURA_MAXIMA_PX: number
  + iniciarEntrada(raiz, { aoEnviar }): { bloquear, limpar, preencher, focar }
}
class "mentorIaService.js" as MentorIaService <<module>> {
  + buscarHistorico({ signal }?): Promise<Mensagem[]>
  + enviarMensagem(texto): Promise<{pergunta,resposta}>
  + buscarExplicacaoProativa({ signal }?): Promise<{mensagens}>
  + buscarAlertas({ signal }?): Promise<Alerta[]>
  + marcarAlertaComoLido(id): Promise<Alerta>
}
class "format.js (mentor-ia)" as FormatMentor <<module>> {
  - hora: Intl.DateTimeFormat
  - diaEHora: Intl.DateTimeFormat
  + formatarHorario(iso): string
}
class "markdown.js" as Markdown <<module>> {
  - ITEM_DE_LISTA: RegExp
  - ITEM_NUMERADO: RegExp
  + markdownParaElementos(texto): DocumentFragment
  - preencherLinha(destino, linha): void
}
class "includes.js" as Includes <<module>>
class "api.js" as Api <<module>>
class "notificacao.js" as Notificacao <<module>>
class "Backend /mentor-ia" as BackendMentorIa <<controller>>
MentorIaIndex ..> Includes : incluirFragmentos
MentorIaIndex ..> MentorPage : iniciarPaginaMentor
MentorPage ..> MentorIaService
MentorPage ..> MentorAlertas : iniciarAlertas
MentorPage ..> MentorConversa : iniciarConversa
MentorPage ..> MentorEntrada : iniciarEntrada
MentorPage ..> Notificacao : notificar
MentorConversa ..> FormatMentor : formatarHorario
MentorConversa ..> Markdown : markdownParaElementos
MentorIaService ..> Api : apiFetch
MentorIaService ..> BackendMentorIa : HTTP
@enduml
```

---

## mentor-ia/index.js

**Tipo:** módulo — **Estereótipo:** «module»
**Arquivo de origem:** `Frontend/src/features/mentor-ia/index.js`

**Descrição:** Ponto de entrada da tela do Mentor IA: monta o HTML e liga MentorPage; desmonta abortando o controlador.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | controlador | AbortController\|null | Controlador de cancelamento da tela montada; abortado em `desmontar()`. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | montar(container) | Promise\<void\> | Monta o HTML da tela no container e inicia a página do Mentor. |
| + | desmontar() | void | Desmonta a tela abortando o controlador. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | includes.js | 1 | incluirFragmentos |
| dependência | MentorPage.js | 1 | iniciarPaginaMentor |

```mermaid
classDiagram
    class MentorIaIndex["mentor-ia/index.js"] {
        <<module>>
        -controlador: AbortController
        +montar(container) Promise~void~
        +desmontar() void
    }
    class Includes["includes.js"] {
        <<module>>
    }
    class MentorPage["MentorPage.js"] {
        <<module>>
    }
    MentorIaIndex ..> Includes : incluirFragmentos
    MentorIaIndex ..> MentorPage : iniciarPaginaMentor
```

```plantuml
@startuml
class "mentor-ia/index.js" as MentorIaIndex <<module>> {
  - controlador: AbortController|null
  + montar(container): Promise<void>
  + desmontar(): void
}
class "includes.js" as Includes <<module>>
class "MentorPage.js" as MentorPage <<module>>
MentorIaIndex ..> Includes : incluirFragmentos
MentorIaIndex ..> MentorPage : iniciarPaginaMentor
@enduml
```

---

## MentorPage.js

**Tipo:** módulo — **Estereótipo:** «module»
**Arquivo de origem:** `Frontend/src/features/mentor-ia/components/MentorPage/MentorPage.js`

**Descrição:** Coordena a página do Mentor: histórico, alertas, insight proativo e envio de perguntas.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | MENSAGENS_DE_ERRO | Record\<string,string\> | Mensagens de erro exibidas ao usuário. |
| - | ESPERA_PARA_MOSTRAR_PENSANDO_MS | number | Espera, em milissegundos, antes de mostrar o estado "pensando". |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarPaginaMentor(raiz, { signal }) | void | Liga os componentes da página (alertas, conversa, entrada) e carrega histórico, alertas e insight proativo. |
| - | mensagemDeErro(erro) | string | Traduz um erro na mensagem apresentada ao usuário. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | mentorIaService.js | 1 | — |
| dependência | MentorAlertas.js | 1 | iniciarAlertas |
| dependência | MentorConversa.js | 1 | iniciarConversa |
| dependência | MentorEntrada.js | 1 | iniciarEntrada |
| dependência | notificacao.js | 1 | notificar |

```mermaid
classDiagram
    class MentorPage["MentorPage.js"] {
        <<module>>
        -MENSAGENS_DE_ERRO: Record
        -ESPERA_PARA_MOSTRAR_PENSANDO_MS: number
        +iniciarPaginaMentor(raiz, opcoes) void
        -mensagemDeErro(erro) string
    }
    MentorPage ..> MentorIaService
    MentorPage ..> MentorAlertas : iniciarAlertas
    MentorPage ..> MentorConversa : iniciarConversa
    MentorPage ..> MentorEntrada : iniciarEntrada
    MentorPage ..> Notificacao : notificar
```

```plantuml
@startuml
class "MentorPage.js" as MentorPage <<module>> {
  - MENSAGENS_DE_ERRO: Record<string,string>
  - ESPERA_PARA_MOSTRAR_PENSANDO_MS: number
  + iniciarPaginaMentor(raiz, { signal }): void
  - mensagemDeErro(erro): string
}
class "mentorIaService.js" as MentorIaService <<module>>
class "MentorAlertas.js" as MentorAlertas <<module>>
class "MentorConversa.js" as MentorConversa <<module>>
class "MentorEntrada.js" as MentorEntrada <<module>>
class "notificacao.js" as Notificacao <<module>>
MentorPage ..> MentorIaService
MentorPage ..> MentorAlertas : iniciarAlertas
MentorPage ..> MentorConversa : iniciarConversa
MentorPage ..> MentorEntrada : iniciarEntrada
MentorPage ..> Notificacao : notificar
@enduml
```

---

## MentorAlertas.js

**Tipo:** módulo — **Estereótipo:** «module»
**Arquivo de origem:** `Frontend/src/features/mentor-ia/components/MentorAlertas/MentorAlertas.js`

**Descrição:** Faixa de alertas não lidos (par MentorAlertas.html/CSS) com botão Entendi.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | NOMES_DOS_TIPOS | Record\<string,string\> | Nomes legíveis dos tipos de alerta. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarAlertas(raiz, { entender, aoEsvaziar, signal }) | { mostrar } | Liga a faixa de alertas; devolve o controle com `mostrar` para exibir a lista. O botão Entendi aciona `entender`; `aoEsvaziar` é chamado quando não restam alertas. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência (entrada) | MentorPage.js | 1 | iniciarAlertas |

O mapeamento não registra dependências de saída para este módulo.

```mermaid
classDiagram
    class MentorAlertas["MentorAlertas.js"] {
        <<module>>
        -NOMES_DOS_TIPOS: Record
        +iniciarAlertas(raiz, opcoes) Controle
    }
    class MentorPage["MentorPage.js"] {
        <<module>>
    }
    MentorPage ..> MentorAlertas : iniciarAlertas
```

```plantuml
@startuml
class "MentorAlertas.js" as MentorAlertas <<module>> {
  - NOMES_DOS_TIPOS: Record<string,string>
  + iniciarAlertas(raiz, { entender, aoEsvaziar, signal }): { mostrar }
}
class "MentorPage.js" as MentorPage <<module>>
MentorPage ..> MentorAlertas : iniciarAlertas
@enduml
```

---

## MentorConversa.js

**Tipo:** módulo — **Estereótipo:** «module»
**Arquivo de origem:** `Frontend/src/features/mentor-ia/components/MentorConversa/MentorConversa.js`

**Descrição:** Área da conversa (par MentorConversa.html/CSS): estados, histórico, perguntas pendentes, respostas e insights.

### Atributos

Nenhum atributo de módulo registrado no mapeamento.

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarConversa(raiz, { tentarNovamente, escolherSugestao }) | { mostrarCarregando, mostrarErro, mostrarHistorico, adicionarPergunta, adicionarResposta, adicionarProativas, pensando } | Liga a área da conversa e devolve o controle com as ações de estado, histórico, pergunta, resposta e insights proativos. |
| - | preencherHorario(item, iso) | void | Preenche o horário de uma mensagem. |
| - | montarMensagem(modelo, mensagem) | HTMLElement | Monta o elemento de uma mensagem a partir de um modelo. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | format.js (mentor-ia) | 1 | formatarHorario |
| dependência | markdown.js | 1 | markdownParaElementos |
| dependência (entrada) | MentorPage.js | 1 | iniciarConversa |

```mermaid
classDiagram
    class MentorConversa["MentorConversa.js"] {
        <<module>>
        +iniciarConversa(raiz, opcoes) Controle
        -preencherHorario(item, iso) void
        -montarMensagem(modelo, mensagem) HTMLElement
    }
    class FormatMentor["format.js (mentor-ia)"] {
        <<module>>
    }
    class Markdown["markdown.js"] {
        <<module>>
    }
    class MentorPage["MentorPage.js"] {
        <<module>>
    }
    MentorPage ..> MentorConversa : iniciarConversa
    MentorConversa ..> FormatMentor : formatarHorario
    MentorConversa ..> Markdown : markdownParaElementos
```

```plantuml
@startuml
class "MentorConversa.js" as MentorConversa <<module>> {
  + iniciarConversa(raiz, { tentarNovamente, escolherSugestao }): Controle
  - preencherHorario(item, iso): void
  - montarMensagem(modelo, mensagem): HTMLElement
}
class "format.js (mentor-ia)" as FormatMentor <<module>>
class "markdown.js" as Markdown <<module>>
class "MentorPage.js" as MentorPage <<module>>
MentorPage ..> MentorConversa : iniciarConversa
MentorConversa ..> FormatMentor : formatarHorario
MentorConversa ..> Markdown : markdownParaElementos
@enduml
```

---

## MentorEntrada.js

**Tipo:** módulo — **Estereótipo:** «module»
**Arquivo de origem:** `Frontend/src/features/mentor-ia/components/MentorEntrada/MentorEntrada.js`

**Descrição:** Campo de pergunta (par MentorEntrada.html/CSS): contador, altura automática, Enter envia e bloqueio do botão.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | ALTURA_MAXIMA_PX | number | Altura máxima, em pixels, do campo de pergunta com altura automática. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | iniciarEntrada(raiz, { aoEnviar }) | { bloquear, limpar, preencher, focar } | Liga o campo de pergunta; `aoEnviar` é chamado ao enviar. Devolve o controle com as ações de bloquear, limpar, preencher e focar. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência (entrada) | MentorPage.js | 1 | iniciarEntrada |

O mapeamento não registra dependências de saída para este módulo.

```mermaid
classDiagram
    class MentorEntrada["MentorEntrada.js"] {
        <<module>>
        -ALTURA_MAXIMA_PX: number
        +iniciarEntrada(raiz, opcoes) Controle
    }
    class MentorPage["MentorPage.js"] {
        <<module>>
    }
    MentorPage ..> MentorEntrada : iniciarEntrada
```

```plantuml
@startuml
class "MentorEntrada.js" as MentorEntrada <<module>> {
  - ALTURA_MAXIMA_PX: number
  + iniciarEntrada(raiz, { aoEnviar }): { bloquear, limpar, preencher, focar }
}
class "MentorPage.js" as MentorPage <<module>>
MentorPage ..> MentorEntrada : iniciarEntrada
@enduml
```

---

## mentorIaService.js

**Tipo:** módulo — **Estereótipo:** «module» (serviço do Frontend)
**Arquivo de origem:** `Frontend/src/features/mentor-ia/services/mentorIaService.js`

**Descrição:** Chamadas ao Backend em /mentor-ia (histórico, enviar mensagem, explicação proativa, alertas, marcar lido).

### Atributos

Nenhum atributo de módulo registrado no mapeamento.

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | buscarHistorico({ signal }?) | Promise\<Mensagem[]\> | Busca o histórico de mensagens do Mentor. |
| + | enviarMensagem(texto) | Promise\<{pergunta,resposta}\> | Envia a pergunta e devolve a pergunta e a resposta. |
| + | buscarExplicacaoProativa({ signal }?) | Promise\<{mensagens}\> | Busca a explicação proativa (insight) do Mentor. |
| + | buscarAlertas({ signal }?) | Promise\<Alerta[]\> | Busca os alertas. |
| + | marcarAlertaComoLido(id) | Promise\<Alerta\> | Marca um alerta como lido. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência | api.js | 1 | apiFetch |
| dependência | Backend /mentor-ia | 1 | HTTP |
| dependência (entrada) | MentorPage.js | 1 | — |

```mermaid
classDiagram
    class MentorIaService["mentorIaService.js"] {
        <<module>>
        +buscarHistorico(opcoes) Promise~Mensagem[]~
        +enviarMensagem(texto) Promise~PerguntaResposta~
        +buscarExplicacaoProativa(opcoes) Promise~Mensagens~
        +buscarAlertas(opcoes) Promise~Alerta[]~
        +marcarAlertaComoLido(id) Promise~Alerta~
    }
    class Api["api.js"] {
        <<module>>
    }
    class BackendMentorIa["Backend /mentor-ia"] {
        <<controller>>
    }
    class MentorPage["MentorPage.js"] {
        <<module>>
    }
    MentorPage ..> MentorIaService
    MentorIaService ..> Api : apiFetch
    MentorIaService ..> BackendMentorIa : HTTP
```

```plantuml
@startuml
class "mentorIaService.js" as MentorIaService <<module>> {
  + buscarHistorico({ signal }?): Promise<Mensagem[]>
  + enviarMensagem(texto): Promise<{pergunta,resposta}>
  + buscarExplicacaoProativa({ signal }?): Promise<{mensagens}>
  + buscarAlertas({ signal }?): Promise<Alerta[]>
  + marcarAlertaComoLido(id): Promise<Alerta>
}
class "api.js" as Api <<module>>
class "Backend /mentor-ia" as BackendMentorIa <<controller>>
class "MentorPage.js" as MentorPage <<module>>
MentorPage ..> MentorIaService
MentorIaService ..> Api : apiFetch
MentorIaService ..> BackendMentorIa : HTTP
@enduml
```

---

## format.js (mentor-ia)

**Tipo:** módulo — **Estereótipo:** «module»
**Arquivo de origem:** `Frontend/src/features/mentor-ia/utils/format.js`

**Descrição:** Formata o horário das mensagens (hora se for de hoje, dia e hora senão).

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | hora | Intl.DateTimeFormat | Formatador usado para mensagens de hoje (somente hora). |
| - | diaEHora | Intl.DateTimeFormat | Formatador usado para mensagens de outros dias (dia e hora). |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | formatarHorario(iso) | string | Formata uma data ISO: apenas a hora se for de hoje, dia e hora caso contrário. |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência (entrada) | MentorConversa.js | 1 | formatarHorario |

```mermaid
classDiagram
    class FormatMentor["format.js (mentor-ia)"] {
        <<module>>
        -hora: Intl.DateTimeFormat
        -diaEHora: Intl.DateTimeFormat
        +formatarHorario(iso) string
    }
    class MentorConversa["MentorConversa.js"] {
        <<module>>
    }
    MentorConversa ..> FormatMentor : formatarHorario
```

```plantuml
@startuml
class "format.js (mentor-ia)" as FormatMentor <<module>> {
  - hora: Intl.DateTimeFormat
  - diaEHora: Intl.DateTimeFormat
  + formatarHorario(iso): string
}
class "MentorConversa.js" as MentorConversa <<module>>
MentorConversa ..> FormatMentor : formatarHorario
@enduml
```

---

## markdown.js

**Tipo:** módulo — **Estereótipo:** «module»
**Arquivo de origem:** `Frontend/src/features/mentor-ia/utils/markdown.js`

**Descrição:** Converte o markdown simples da IA (parágrafos, listas, negrito) em elementos DOM sem innerHTML.

### Atributos

| Visibilidade | Nome | Tipo | Descrição |
|---|---|---|---|
| - | ITEM_DE_LISTA | RegExp | Reconhece item de lista com marcador. |
| - | ITEM_NUMERADO | RegExp | Reconhece item de lista numerada. |

### Operações

| Visibilidade | Assinatura | Retorno | Descrição |
|---|---|---|---|
| + | markdownParaElementos(texto) | DocumentFragment | Converte o texto em markdown simples em elementos DOM, sem usar innerHTML. |
| - | preencherLinha(destino, linha) | void | Preenche o elemento de destino com o conteúdo de uma linha (incluindo negrito). |

### Relações

| Tipo | Alvo | Multiplicidade | Rótulo |
|---|---|---|---|
| dependência (entrada) | MentorConversa.js | 1 | markdownParaElementos |

```mermaid
classDiagram
    class Markdown["markdown.js"] {
        <<module>>
        -ITEM_DE_LISTA: RegExp
        -ITEM_NUMERADO: RegExp
        +markdownParaElementos(texto) DocumentFragment
        -preencherLinha(destino, linha) void
    }
    class MentorConversa["MentorConversa.js"] {
        <<module>>
    }
    MentorConversa ..> Markdown : markdownParaElementos
```

```plantuml
@startuml
class "markdown.js" as Markdown <<module>> {
  - ITEM_DE_LISTA: RegExp
  - ITEM_NUMERADO: RegExp
  + markdownParaElementos(texto): DocumentFragment
  - preencherLinha(destino, linha): void
}
class "MentorConversa.js" as MentorConversa <<module>>
MentorConversa ..> Markdown : markdownParaElementos
@enduml
```
