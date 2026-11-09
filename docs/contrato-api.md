# Contrato da API do FinanceAI

Documento vivo que descreve **o que o Backend aceita e devolve**. É a referência do Frontend e dos outros grupos. Os exemplos de resposta foram capturados da API em funcionamento, não escritos à mão.

**Regra do grupo:** quem cria ou muda uma rota atualiza este documento **no mesmo Pull Request** do código.

## Estado por módulo

| Módulo | Prefixo | Grupo | Estado |
|---|---|---|---|
| Sistema | `/v1/health`, `/v1/eco` | Todos | Documentado (seção 1.6) |
| Transações | `/v1/transactions` | 2 | **Cadastro, listagem (com filtros e paginação), edição e exclusão em lote documentados** (seção 2); duplicação e importação planejadas |
| Autenticação e conta | `/v1/auth` | 1 | A documentar |
| Painel e análise | `/v1/dashboard` | 3 | A documentar |
| Mentor financeiro (IA) | `/v1/mentor-ia` | 4 | **Chat (enviar mensagem e histórico) e alertas (listar e marcar como lido) documentados** (seção 3) |
| Metas | `/v1/goals` | 5 | A documentar |
| Investimentos | `/v1/investments` | 5 | A documentar |

---

## 1. Convenções gerais

### 1.1 Base e formato

- URL base em desenvolvimento: `http://localhost:3001/v1`.
- Corpo e respostas em **JSON** (UTF-8), com o header `Content-Type: application/json` nas requisições que têm corpo.

### 1.2 Autenticação

- As rotas exigem o header `Authorization: Bearer <token>`, com o JWT devolvido pelo login. Só `/v1/health`, `/v1/eco` e as rotas públicas de `/v1/auth` (cadastro e login) não exigem.
- Token ausente, inválido ou expirado devolve `401` com o código `UNAUTHENTICATED`.
- O usuário é sempre o **dono do token**. Um `userId` enviado no corpo ou na URL é ignorado: um usuário nunca enxerga nem altera dados de outro.

### 1.3 Tipos e formatos

| Tipo | Formato |
|---|---|
| Identificador (`id`) | Texto de 24 caracteres hexadecimais, por exemplo `"6ad3fd7c273f8f0946dd77e5"` |
| Valor monetário | Número em reais com ponto decimal, por exemplo `42.9`. Sem texto, sem símbolo, sem vírgula. Sempre positivo (o `tipo` da transação diz se entra ou sai) |
| Data na resposta | ISO 8601 em UTC, por exemplo `"2026-10-05T12:00:00.000Z"` |
| Data na entrada | `"2026-10-05"` (vale **meia-noite UTC**) ou ISO completo com fuso, por exemplo `"2026-10-05T12:00:00-03:00"`. Se a hora local importa, envie o ISO completo |

### 1.4 Formato de erro

Todo erro tem o mesmo formato, e o Frontend decide o que fazer pelo `code`, nunca pelo texto da mensagem:

```json
{
  "error": {
    "message": "Dados inválidos",
    "code": "VALIDATION_ERROR",
    "details": { "valor": ["Number must be greater than 0"] }
  }
}
```

- `details` só aparece em `VALIDATION_ERROR`: é um mapa **campo → lista de mensagens**. As mensagens são técnicas e estão em inglês; o Frontend deve mostrar o próprio texto para cada campo.

### 1.5 Códigos de erro

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Corpo ou parâmetros inválidos (campo ausente, tipo errado, valor fora da regra, filtros incoerentes) |
| 401 | `UNAUTHENTICATED` | Token ausente, inválido ou expirado |
| 404 | `NOT_FOUND` | Rota inexistente |
| 500 | `INTERNAL_ERROR` | Falha inesperada no servidor |
| 502 | `JAVA_SERVER_ERROR` | O Servidor de cálculos respondeu algo inesperado |
| 503 | `JAVA_SERVER_UNAVAILABLE` | O Servidor de cálculos está fora do ar (só afeta as rotas que dependem dele) |
| 503 | `JAVA_SERVER_SHUTTING_DOWN` | O Servidor de cálculos está sendo desligado |

Cada módulo acrescenta os seus códigos de negócio na própria seção (por exemplo, `EMAIL_IN_USE` e `INVALID_CREDENTIALS` na autenticação, `TRANSACTION_NOT_FOUND` nas transações).

### 1.6 Rotas do sistema

| Método e rota | Resposta | Uso |
|---|---|---|
| `GET /v1/health` | `200 {"status":"ok"}` | Confere que o Backend está de pé. Não exige token |
| `POST /v1/eco` | `200` com o mesmo corpo enviado | Teste do caminho Backend → Servidor de cálculos. Sai quando os módulos reais estiverem prontos |

---

## 2. Transações — `/v1/transactions` (Grupo 2)

Todas as rotas exigem token. Um usuário só vê e altera as próprias transações.

### 2.1 Objeto `Transaction`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador da transação |
| `tipo` | `"receita"` ou `"despesa"` | Se o dinheiro entrou ou saiu |
| `valor` | número | Valor em reais, sempre positivo |
| `categoria` | texto | Categoria (ver 2.3). Se não for enviada no cadastro, o Servidor Java a sugere pela descrição (ver 2.4); sem palavra-chave conhecida, vale `"Outros"` |
| `data` | texto (ISO 8601) | Data da movimentação |
| `descricao` | texto | Descrição livre |
| `formaPagamento` | texto | Uma das formas de pagamento (ver 2.2). Se não for enviada, vale `"outro"` |
| `observacoes` | texto | Anotação livre de até 300 caracteres. **Só aparece quando foi informada** |
| `origem` | `"manual"` ou `"pluggy"` | Como a transação entrou: digitada pelo usuário ou importada |

### 2.2 Formas de pagamento

`dinheiro`, `pix`, `debito`, `credito`, `boleto`, `outro`.

### 2.3 Categorias sugeridas

O campo `categoria` é texto livre, mas o Frontend deve oferecer esta lista para não fragmentar os totais do painel: `Alimentacao`, `Transporte`, `Moradia`, `Saude`, `Lazer`, `Educacao`, `Salario`, `Outros`. A categorização automática (Servidor de cálculos) usa estes mesmos nomes.

### 2.4 Cadastrar transação

`POST /v1/transactions` → `201 Created`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `tipo` | texto | Sim | `receita` ou `despesa` |
| `valor` | **número** | Sim | Maior que zero. Texto como `"10"` é recusado |
| `data` | texto | Sim | Data válida (ver 1.3) |
| `descricao` | texto | Sim | Não vazio (espaços nas pontas são removidos) |
| `categoria` | texto | Não | Se faltar, o Backend pede ao Servidor Java (`PedidoCategorizarTransacao`) uma categoria pela `descricao`: `"Uber Eats"` vira `Alimentacao`, `"Farmácia"` vira `Saude`. Sem palavra-chave conhecida, vale `"Outros"`. Se o Servidor estiver fora do ar, a transação é salva com `"Outros"` (o cadastro não falha). Se vier preenchida, é usada como está |
| `formaPagamento` | texto | Não | Uma da lista 2.2. Se faltar, vale `"outro"` |
| `observacoes` | texto | Não | Até 300 caracteres (espaços nas pontas são removidos). Texto vazio é o mesmo que não enviar |
| `origem` | texto | Não | `manual` (padrão) ou `pluggy` |

Exemplo, requisição completa:

```json
{
  "tipo": "despesa",
  "valor": 42.9,
  "categoria": "Alimentacao",
  "data": "2026-10-05T12:00:00Z",
  "descricao": "Supermercado",
  "formaPagamento": "debito"
}
```

Resposta `201`:

```json
{
  "id": "6ad3fd7c273f8f0946dd77e5",
  "tipo": "despesa",
  "valor": 42.9,
  "categoria": "Alimentacao",
  "data": "2026-10-05T12:00:00.000Z",
  "descricao": "Supermercado",
  "formaPagamento": "debito",
  "origem": "manual"
}
```

Exemplo, requisição mínima (só os campos obrigatórios):

```json
{ "tipo": "receita", "valor": 1500, "data": "2026-10-01", "descricao": "Salário" }
```

Resposta `201` (os campos que faltaram recebem o padrão):

```json
{
  "id": "6ad3fd7c273f8f0946dd77e7",
  "tipo": "receita",
  "valor": 1500,
  "categoria": "Outros",
  "data": "2026-10-01T00:00:00.000Z",
  "descricao": "Salário",
  "formaPagamento": "outro",
  "origem": "manual"
}
```

Erros:

| Status | `code` | Exemplo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Corpo inválido (ver abaixo). Um `userId` no corpo não causa erro: é ignorado |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |

Resposta `400` quando vários campos estão errados (`{"tipo":"transferencia","valor":-5,"data":"ontem","descricao":"  ","formaPagamento":"cheque"}`):

```json
{
  "error": {
    "message": "Dados inválidos",
    "code": "VALIDATION_ERROR",
    "details": {
      "tipo": ["Invalid enum value. Expected 'receita' | 'despesa', received 'transferencia'"],
      "valor": ["Number must be greater than 0"],
      "data": ["Invalid date"],
      "descricao": ["String must contain at least 1 character(s)"],
      "formaPagamento": ["Invalid enum value. Expected 'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'outro', received 'cheque'"]
    }
  }
}
```

### 2.5 Listar transações

`GET /v1/transactions` → `200 OK`, com **uma página** de transações e os dados para montar a paginação (ver "Resposta").

- Devolve só as transações do usuário do token, da **mais recente para a mais antiga** (pela `data`; em empate, a criada por último vem primeiro).
- Sempre paginada: sem `limite` e `pagina`, devolve a página 1 com até 20 itens.

Parâmetros de consulta (todos opcionais, combinam entre si com "e"):

| Parâmetro | Tipo | Efeito |
|---|---|---|
| `tipo` | `receita` ou `despesa` | Só receitas ou só despesas |
| `categoria` | texto | Só desta categoria (comparação exata) |
| `formaPagamento` | texto | Só desta forma de pagamento (lista 2.2) |
| `busca` | texto de 1 a 100 caracteres | Só transações cuja `descricao` **contém** o texto (sem diferenciar maiúsculas de minúsculas) |
| `origem` | `manual` ou `pluggy` | Só desta origem |
| `dataInicio` | data | `data` maior ou igual a este valor |
| `dataFim` | data | `data` menor ou igual a este valor. Se for meia-noite UTC (como `2026-10-31`), inclui o **dia inteiro** |
| `valorMin` | número ≥ 0 | `valor` maior ou igual a este valor |
| `valorMax` | número ≥ 0 | `valor` menor ou igual a este valor |
| `pagina` | inteiro ≥ 1 | Qual página devolver. Padrão `1` |
| `limite` | inteiro de 1 a 100 | Quantos itens por página. Padrão `20` |

Os limites de data e de valor são **inclusivos**. `valorMin` não pode ser maior que `valorMax`, e `dataInicio` não pode ser depois de `dataFim`.

**Resposta:**

| Campo | Tipo | Descrição |
|---|---|---|
| `itens` | lista de `Transaction` | As transações desta página |
| `pagina` | inteiro | A página devolvida (começa em 1) |
| `limite` | inteiro | Itens por página |
| `total` | inteiro | Quantas transações passam nos filtros, somando **todas** as páginas |
| `totalPaginas` | inteiro | `ceil(total / limite)`. É `0` quando não há nenhuma transação |
| `resumo` | objeto | Totais de **todas** as transações que passam nos filtros (não só desta página): `receitas`, `despesas` (somas, sempre positivas) e `saldo` (`receitas - despesas`, pode ser negativo). É assim que a tela mostra o extrato sem somar página por página |

Exemplo: `GET /v1/transactions?valorMin=100&dataInicio=2026-10-01&dataFim=2026-10-31`

```json
{
  "itens": [
    {
      "id": "6ad3ffeadf71ebb52b124d91",
      "tipo": "receita",
      "valor": 1500,
      "categoria": "Outros",
      "data": "2026-10-01T00:00:00.000Z",
      "descricao": "Salário",
      "formaPagamento": "outro",
      "origem": "manual"
    }
  ],
  "pagina": 1,
  "limite": 20,
  "total": 1,
  "totalPaginas": 1,
  "resumo": { "receitas": 1500, "despesas": 0, "saldo": 1500 }
}
```

Exemplo de paginação: `GET /v1/transactions?limite=1&pagina=2` (o usuário tem 2 transações)

```json
{
  "itens": [
    {
      "id": "6ad3ffeadf71ebb52b124d91",
      "tipo": "receita",
      "valor": 1500,
      "categoria": "Outros",
      "data": "2026-10-01T00:00:00.000Z",
      "descricao": "Salário",
      "formaPagamento": "outro",
      "origem": "manual"
    }
  ],
  "pagina": 2,
  "limite": 1,
  "total": 2,
  "totalPaginas": 2,
  "resumo": { "receitas": 1500, "despesas": 42.9, "saldo": 1457.1 }
}
```

Como usar na tela:
- Mostre "página `pagina` de `totalPaginas`" e habilite "próxima" enquanto `pagina < totalPaginas`.
- Os filtros valem para o `total` e o `resumo` também: com `categoria=Alimentacao`, os dois contam só as dessa categoria.
- Pedir uma página **além da última** não é erro: a resposta traz `"itens": []`, mantendo o `total` e o `totalPaginas`.
- Sem nenhuma transação, a resposta é `{"itens":[],"pagina":1,"limite":20,"total":0,"totalPaginas":0,"resumo":{"receitas":0,"despesas":0,"saldo":0}}`.

Erros:

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Parâmetro inválido: `tipo`, `formaPagamento` ou `origem` desconhecidos, `busca` vazia ou com mais de 100 caracteres, número ou data inválidos, `valorMin` maior que `valorMax`, `dataInicio` depois de `dataFim`, `pagina` menor que 1, `limite` fora de 1 a 100 ou não inteiro |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |

Exemplo de `400` para `?limite=500&pagina=0`:

```json
{
  "error": {
    "message": "Dados inválidos",
    "code": "VALIDATION_ERROR",
    "details": {
      "pagina": ["Number must be greater than or equal to 1"],
      "limite": ["Number must be less than or equal to 100"]
    }
  }
}
```

Exemplo de `400` para `?valorMin=100&valorMax=50`:

```json
{
  "error": {
    "message": "Dados inválidos",
    "code": "VALIDATION_ERROR",
    "details": { "valorMin": ["valorMin não pode ser maior que valorMax"] }
  }
}
```

### 2.6 Editar transações

`PATCH /v1/transactions/bulk` → `200 OK`.

**Não existe `PUT` nem `DELETE` por id: a edição e a exclusão só acontecem em lote.** Para mexer em uma única transação, envie um lote de um item. O lote **não é tudo ou nada**: o Backend faz o que existe e devolve os ids que não encontrou. Cada chamada aceita de 1 a **100** itens, sem ids repetidos (a tela divide em blocos quando passa disso).

Cada transação leva as **suas próprias** alterações. A edição é **parcial**: `alteracoes` leva só os campos que mudam e precisa ter ao menos um.

```json
{
  "itens": [
    { "id": "6ae4a14014fb37bcbb2d7fac", "alteracoes": { "descricao": "Mercado", "valor": 11.5, "observacoes": "" } },
    { "id": "6ae4a14014fb37bcbb2d7fad", "alteracoes": { "categoria": "Lazer", "tipo": "receita" } }
  ]
}
```

| Campo de `alteracoes` | Tipo | Regra |
|---|---|---|
| `tipo` | `"receita"` ou `"despesa"` | |
| `valor` | número | Maior que zero |
| `categoria` | texto | Não vazio |
| `data` | texto (data ISO) | Ex.: `"2026-10-30"` |
| `descricao` | texto | Não vazio |
| `formaPagamento` | texto | Uma das formas da seção 2.2. Aqui **não** há valor padrão: o que não for enviado não muda |
| `observacoes` | texto | Até 300 caracteres. **`""` apaga a observação** |

`origem` e `id` dentro de `alteracoes` são ignorados: a origem nunca muda.

Resposta:

```json
{ "afetadas": 1, "naoEncontradas": ["6ae4a14014fb37bcbb2d7fad"] }
```

`naoEncontradas` traz os ids que não existem ou são de outro usuário (os dois casos são tratados igual, sem revelar de quem é).

Erros: `400 VALIDATION_ERROR` (lista vazia, mais de 100 itens, ids repetidos ou mal formados, `alteracoes` vazia ou com campo inválido: nesse caso **nada** do lote é aplicado) e `401 UNAUTHENTICATED`.

### 2.7 Excluir transações

`POST /v1/transactions/bulk-delete` → `200 OK` (é `POST` porque um `DELETE` com corpo não é confiável em todos os clientes). Também vale um lote de um id só.

```json
{ "ids": ["6ae4a14014fb37bcbb2d7fac", "6ae4a14014fb37bcbb2d7fad"] }
```

A resposta tem o mesmo formato da edição (`afetadas` e `naoEncontradas`). Excluir um id que já foi excluído o devolve em `naoEncontradas`.

Erros: `400 VALIDATION_ERROR` (lista vazia, mais de 100 ids, ids repetidos ou mal formados) e `401 UNAUTHENTICATED`.

### 2.8 Rotas planejadas (ainda não existem)

| Método e rota | Para quê | Issue |
|---|---|---|
| `POST /v1/transactions/:id/duplicate` | Duplicar um lançamento | #49 |
| `POST /v1/transactions/import` | Importar do sandbox da Pluggy | #46 |

---

## 3. Mentor financeiro (IA) — `/v1/mentor-ia` (Grupo 4)

Todas as rotas exigem token. O chat usa as **transações do mês atual** do usuário (do dia 1 até hoje, no horário de Brasília) para responder; quanto mais transações cadastradas, melhor a resposta.

Regras que valem para toda resposta da IA:
- É **educacional**: explica gastos, orçamento e conceitos. Não substitui um consultor.
- **Nunca recomenda comprar, vender ou aportar em um ativo específico** (ação, fundo, criptomoeda, título). A resposta passa por um filtro no Servidor de cálculos: a frase que recomenda um ativo é removida e um aviso é acrescentado no final.
- Os números citados (totais, percentuais por categoria, média diária) são calculados pelo Servidor de cálculos, não pela IA.

### 3.1 Objeto `ChatMessage`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador da mensagem |
| `autor` | `"usuario"` ou `"ia"` | Quem escreveu |
| `texto` | texto | Conteúdo. O da IA pode ter **markdown simples** (`**negrito**`, listas com `-`): o Frontend pode mostrar como texto puro ou converter |
| `criadaEm` | texto (ISO 8601) | Quando foi enviada |

### 3.2 Enviar mensagem

`POST /v1/mentor-ia/chat` → `200 OK`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `texto` | texto | Sim | De 1 a 2000 caracteres (espaços nas pontas são removidos) |

A resposta **demora alguns segundos** (normalmente de 1 a 5; o máximo é 20, depois disso a rota devolve `503`). Mostre um estado de "pensando" e desabilite o botão de enviar enquanto espera. A pergunta e a resposta só são salvas no histórico quando a IA responde: se a rota der erro, nada é salvo e o usuário pode tentar de novo.

Exemplo:

```json
{ "texto": "Qual categoria pesa mais nos meus gastos e quanto ela representa?" }
```

Resposta `200`:

```json
{
  "pergunta": {
    "id": "6ae25d66e542d862dbe113fc",
    "autor": "usuario",
    "texto": "Qual categoria pesa mais nos meus gastos e quanto ela representa?",
    "criadaEm": "2026-10-28T20:39:02.684Z"
  },
  "resposta": {
    "id": "6ae25d66e542d862dbe113fd",
    "autor": "ia",
    "texto": "A categoria que pesa mais nos seus gastos é **Moradia**, com gasto de **R$ 1.400,00**, o que corresponde a **48,2 %** do total das despesas.",
    "criadaEm": "2026-10-28T20:39:02.687Z"
  }
}
```

(Capturado com os dados do seed: `npm run seed:transacoes`.) Quando o usuário pede um ativo específico (`"Devo comprar PETR4 com o que sobrou?"`), a IA recusa e orienta sobre orçamento: "Não posso recomendar a compra de um ativo específico. Posso ajudar a entender como o seu saldo disponível pode ser alocado, ...".

Erros:

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `texto` ausente, vazio ou com mais de 2000 caracteres |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 429 | `GENAI_RATE_LIMITED` | Acabou o limite de uso gratuito da API de IA. Mostre "tente de novo em alguns minutos" |
| 502 | `GENAI_ERROR` | A API de IA respondeu com erro ou sem conteúdo |
| 503 | `GENAI_UNAVAILABLE` | A API de IA está fora do ar, demorou mais de 20 s ou não foi configurada no Backend |
| 503 | `JAVA_SERVER_UNAVAILABLE` | O Servidor de cálculos está fora do ar (ele monta o resumo e filtra a resposta) |

### 3.3 Histórico do chat

`GET /v1/mentor-ia/chat` → `200 OK`, com as **últimas 50 mensagens** do usuário, da **mais antiga para a mais nova** (a ordem de exibição do chat). Sem conversa, devolve `[]`.

```json
[
  {
    "id": "6ae25d66e542d862dbe113fc",
    "autor": "usuario",
    "texto": "Qual categoria pesa mais nos meus gastos e quanto ela representa?",
    "criadaEm": "2026-10-28T20:39:02.684Z"
  },
  {
    "id": "6ae25d66e542d862dbe113fd",
    "autor": "ia",
    "texto": "A categoria que pesa mais nos seus gastos é **Moradia**, ...",
    "criadaEm": "2026-10-28T20:39:02.687Z"
  }
]
```

As 6 mensagens mais recentes também são enviadas à IA junto com a pergunta nova, para ela entender perguntas de continuação ("como reduzir isso?", "explica melhor"). Ela só conhece o mês atual: perguntas sobre meses anteriores recebem "não tenho essa informação".

Erros: `401 UNAUTHENTICATED`.

### 3.4 Objeto `Alert`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador do alerta |
| `tipo` | `"gasto_fora_do_padrao"`, `"fatura_proxima"` ou `"dinheiro_parado"` | Qual regra gerou o alerta (seção 3.5) |
| `titulo` | texto | Título curto, por exemplo `"Fatura do cartão perto do vencimento"` |
| `mensagem` | texto | Uma ou duas frases em português, com os valores já formatados (`"R$ 1.234,56"`). Pode ser mostrada como está |
| `dados` | objeto | Os números do alerta, para o Frontend montar a própria tela (campos por tipo na seção 3.5). Valores em reais, datas em ISO 8601 |
| `lido` | booleano | Sempre `false` na listagem; `true` depois de `PATCH .../lido` |
| `criadaEm` | texto (ISO 8601) | Quando o alerta apareceu pela primeira vez |

### 3.5 Como os alertas são gerados

Os alertas são **gerados pelo Backend no momento em que são lidos** (`GET /v1/mentor-ia/alerts`), a partir das transações reais do usuário: não há job agendado nem gancho no cadastro de transações. Por isso a listagem sempre reflete o estado atual, inclusive transações editadas ou excluídas.

- Cada alerta tem uma chave por período (por exemplo, a fatura de novembro de 2026): ler os alertas de novo **não duplica** nada, só atualiza os números do mesmo alerta.
- Um alerta **marcado como lido não volta** no mesmo período.
- Um alerta **não lido cuja condição deixou de valer** (por exemplo, o usuário excluiu o gasto que o gerou, ou o período passou) é **removido** na leitura seguinte.
- Datas e meses são os de **Brasília**. O histórico lido vai do dia 1 do 3º mês anterior até hoje.

| `tipo` | Quando aparece | `dados` |
|---|---|---|
| `gasto_fora_do_padrao` | Numa categoria de despesa, o gasto do **mês atual até hoje** já é **pelo menos 2 vezes o maior gasto mensal** dessa categoria nos **3 meses anteriores**, com **pelo menos R$ 200 a mais**, e a categoria teve gasto em pelo menos 2 desses 3 meses. Um alerta por categoria e por mês | `categoria`, `valorAtual`, `maiorMesAnterior`, `mediaMensal` (média dos meses anteriores com gasto) |
| `fatura_proxima` | Faltam **5 dias ou menos** para o vencimento da fatura e ela tem valor. Um alerta por fatura (mês do vencimento) | `valor`, `vencimento`, `diasParaVencer`, `inicioDoCiclo`, `fechamento` |
| `dinheiro_parado` | O que sobrou (receitas menos despesas) desde o dia 1 do 3º mês anterior é de **pelo menos R$ 500** e de **pelo menos 1 mês de despesas** (média dos meses anteriores com movimento), há movimento em pelo menos 2 dos 3 meses anteriores e **nenhuma transação na categoria `Investimento`/`Investimentos`** no período. Um alerta por mês | `saldo`, `receitas`, `despesas`, `despesaMensalMedia`, `desde` |

**Suposição da fatura:** ainda não existe cartão cadastrado (o Grupo 5 vai simular faturas). Até lá a fatura é **estimada** como a soma das despesas com `formaPagamento: "credito"` do ciclo fechado, supondo **vencimento todo dia 10** e **fechamento 7 dias antes (dia 3)**: a fatura que vence em 10/11 tem as compras no crédito de 03/10 a 02/11. Quando houver cartão de verdade, a regra passa a usar o vencimento e o valor dele.

O alerta de dinheiro parado é **educativo**: sugere separar uma reserva de emergência ou estudar opções de investimento, e nunca cita ativo, produto ou instituição.

Os limites foram escolhidos para **não gerar nenhum `gasto_fora_do_padrao` com os dados do seed** (seção 4) em nenhum dia do ano. Com o seed aparecem só alertas verdadeiros: `fatura_proxima` do dia 5 ao dia 10 de cada mês (o seed tem compras no crédito todo mês) e `dinheiro_parado` (o seed tem sobra de salário e nenhum investimento). Para ver um gasto fora do padrão, cadastre por exemplo uma despesa de R$ 1.500 em `Alimentacao` no mês atual.

### 3.6 Listar alertas

`GET /v1/mentor-ia/alerts` → `200 OK`, com os alertas **não lidos** do usuário, dos **mais recentes para os mais antigos**. Sem alertas, devolve `[]`. Não depende do Servidor de cálculos nem da API de IA.

```json
[
  {
    "id": "6af1bbb52676e89cd05622c2",
    "tipo": "gasto_fora_do_padrao",
    "titulo": "Gasto fora do padrão em Alimentacao",
    "mensagem": "Em novembro você já gastou R$ 2.070,85 com Alimentacao, 3,2 vezes o maior gasto mensal dessa categoria nos últimos 3 meses (R$ 647,40).",
    "dados": { "categoria": "Alimentacao", "valorAtual": 2070.85, "maiorMesAnterior": 647.4, "mediaMensal": 400.55 },
    "lido": false,
    "criadaEm": "2026-11-09T12:26:22.541Z"
  },
  {
    "id": "6af1bba92676e89cd05622bf",
    "tipo": "dinheiro_parado",
    "titulo": "Dinheiro parado na conta",
    "mensagem": "Desde 01/08 sobraram R$ 7.083,00 (receitas menos despesas), mais do que você gasta em um mês (R$ 1.664,68 em média), e não há nenhum investimento registrado. Se esse dinheiro está parado, considere separar uma reserva de emergência ou estudar opções de investimento.",
    "dados": { "saldo": 7083, "receitas": 15670, "despesas": 8587, "despesaMensalMedia": 1664.68, "desde": "2026-08-01T03:00:00.000Z" },
    "lido": false,
    "criadaEm": "2026-11-09T12:26:10.837Z"
  },
  {
    "id": "6af1bba92676e89cd05622be",
    "tipo": "fatura_proxima",
    "titulo": "Fatura do cartão perto do vencimento",
    "mensagem": "A fatura do cartão de crédito vence amanhã (10/11): são R$ 434,70 em compras no crédito de 03/10 a 02/11. Reserve esse valor para não pagar juros.",
    "dados": {
      "valor": 434.7,
      "vencimento": "2026-11-10T03:00:00.000Z",
      "diasParaVencer": 1,
      "inicioDoCiclo": "2026-10-03T03:00:00.000Z",
      "fechamento": "2026-11-03T03:00:00.000Z"
    },
    "lido": false,
    "criadaEm": "2026-11-09T12:26:10.837Z"
  }
]
```

(Capturado em 09/11/2026 com os dados do seed mais uma despesa de R$ 1.500 em `Alimentacao`.)

Erros: `401 UNAUTHENTICATED`.

### 3.7 Marcar alerta como lido

`PATCH /v1/mentor-ia/alerts/:id/lido` → `200 OK`, sem corpo na requisição. Devolve o alerta (objeto `Alert`) com `lido: true`. Ele deixa de aparecer na listagem e não volta no mesmo período. Marcar de novo um alerta já lido também devolve `200`.

Erros:

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `id` não tem 24 caracteres hexadecimais |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 404 | `ALERT_NOT_FOUND` | O alerta não existe ou é de outro usuário |

---

## 4. Dados de exemplo (seed)

Para desenvolver sem digitar tudo, o Backend tem um script que insere cerca de 33 transações dos últimos 3 meses (receitas, despesas, várias categorias e formas de pagamento), com datas relativas a hoje. Na pasta `Backend`, com a `MONGO_URI` no `.env`:

```bash
npm run seed:transacoes                        # para o usuário "usuario-demo"
npm run seed:transacoes -- <userId>            # para um usuário específico
npm run seed:transacoes -- <userId> --limpar   # apaga antes as transações desse usuário
```

Sem `--limpar`, rodar de novo **acrescenta** mais transações. Use o `userId` que está dentro do seu token para ver os dados pela API.
