# Contrato da API do FinanceAI

Documento vivo que descreve **o que o Backend aceita e devolve**. É a referência do Frontend e dos outros grupos. Os exemplos de resposta foram capturados da API em funcionamento, não escritos à mão.

**Regra do grupo:** quem cria ou muda uma rota atualiza este documento **no mesmo Pull Request** do código.

## Estado por módulo

| Módulo | Prefixo | Grupo | Estado |
|---|---|---|---|
| Sistema | `/v1/health`, `/v1/eco` | Todos | Documentado (seção 1.6) |
| Transações | `/v1/transactions` | 2 | **Cadastro, listagem (com filtros e paginação), edição e exclusão em lote documentados** (seção 2); contas conectadas e importação da Pluggy documentadas (2.8); duplicação (2.9) |
| Autenticação e conta | `/v1/auth` | 1 | A documentar |
| Painel e análise | `/v1/dashboard` | 3 | A documentar |
| Mentor financeiro (IA) | `/v1/mentor-ia` | 4 | **Chat (enviar mensagem, histórico e mensagem proativa) e alertas (listar e marcar como lido) documentados** (seção 3) |
| Metas | `/v1/goals` | 5 | **CRUD das metas, com o progresso calculado a partir das transações vinculadas a cada meta, documentado** (seção 5; o vínculo é o `metaId` das transações, 2.4 e 2.6) |
| Investimentos | `/v1/investments` | 5 | **Cartão simulado (fatura e limite) e parcelamentos, com tela; portfólio e patrimônio documentados, sem tela (feature futura)** (seção 6) |
| Suporte | `/v1/suporte` | 1 | Cadastro de relatos de problemas documentado (seção 7) |

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

Cada módulo acrescenta os seus códigos de negócio na própria seção (por exemplo, `EMAIL_IN_USE` e `INVALID_CREDENTIALS` na autenticação, `TRANSACTION_NOT_FOUND` nas transações). Os da integração com a Pluggy (`PLUGGY_*` e `ACCOUNT_*`) estão na seção 2.8, os das metas (`GOAL_NOT_FOUND`) na 5.3 e os dos investimentos e do cartão (`INVESTMENT_NOT_FOUND`, `INSTALLMENT_NOT_FOUND`) na 6.4.

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
| `origem` | `"manual"` ou `"pluggy"` | Como a transação entrou: digitada pelo usuário ou importada de uma conta conectada (ver 2.8) |
| `metaId` | texto | A meta a que a transação foi vinculada (seção 5): se for despesa, soma no progresso da meta; se for receita, subtrai. **Só aparece quando a transação foi vinculada** |
| `cartaoId` | texto | O cartão de crédito (6.2) em que a compra foi feita. **Só aparece em transações no crédito que têm cartão** |
| `parcelas` | inteiro | Em quantas vezes a compra foi feita (1 = à vista). **Só aparece em transações no crédito** |
| `parcelamentoId` | texto | O parcelamento criado no cartão para uma compra em mais de 1 parcela (6.3). **Só aparece em compras parceladas** |

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
| `metaId` | texto | Não | Id de uma **meta do próprio usuário** (seção 5): a transação fica vinculada a ela: despesa soma no progresso da meta e receita subtrai. Uma meta que não existe, ou que é de outro usuário, responde `404 GOAL_NOT_FOUND` e **nada é salvo**. Id mal formado: `400 VALIDATION_ERROR` |
| `cartaoId` | texto | Não | Id de um **cartão do próprio usuário** (6.2). Só vale com `formaPagamento: "credito"` (com outra forma, 400). Sem `cartaoId`, a compra no crédito conta para o cartão mais antigo |
| `parcelas` | inteiro | Não | De 1 a 24 (padrão 1, à vista). Só vale no crédito e só em **despesa manual**. Com mais de 1 parcela, o Backend cria o parcelamento correspondente no cartão (sem juros, nenhuma parcela paga) e liga a transação a ele (`parcelamentoId`) |

**Compra parcelada:** o valor da transação é o **total** da compra. A fatura do cartão conta as parcelas do parcelamento no lugar da compra (a mesma compra nunca entra duas vezes). Um `cartaoId` inexistente ou de outro usuário devolve `404 CARD_NOT_FOUND` e nada é salvo.

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
| `cartaoId` | id de um cartão (6.2) | Só as **despesas no crédito** desse cartão; as sem cartão contam para o cartão padrão (o mais antigo), como na fatura. Cartão de outro usuário ou inexistente: `404 CARD_NOT_FOUND` |
| `metaId` | id de uma meta ou `nenhuma` | Só as transações vinculadas a essa meta (seção 5), ou só as que não têm meta |
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
| 400 | `VALIDATION_ERROR` | Parâmetro inválido: `tipo`, `formaPagamento` ou `origem` desconhecidos, `metaId` que não é um id nem `nenhuma`, `busca` vazia ou com mais de 100 caracteres, número ou data inválidos, `valorMin` maior que `valorMax`, `dataInicio` depois de `dataFim`, `pagina` menor que 1, `limite` fora de 1 a 100 ou não inteiro |
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
| `metaId` | texto ou `null` | Vincula a transação a uma meta do próprio usuário (seção 5); **`null` desvincula**. Uma meta que não existe ou é de outro usuário recusa o lote **inteiro** com `404 GOAL_NOT_FOUND`, antes de gravar qualquer item |

`origem` e `id` dentro de `alteracoes` são ignorados: a origem nunca muda. Qualquer transação pode ser vinculada, inclusive as importadas da Pluggy.

Resposta:

```json
{ "afetadas": 1, "naoEncontradas": ["6ae4a14014fb37bcbb2d7fad"] }
```

`naoEncontradas` traz os ids que não existem ou são de outro usuário (os dois casos são tratados igual, sem revelar de quem é).

Erros: `400 VALIDATION_ERROR` (lista vazia, mais de 100 itens, ids repetidos ou mal formados, `alteracoes` vazia ou com campo inválido, `metaId` mal formado: nesse caso **nada** do lote é aplicado), `401 UNAUTHENTICATED` e `404 GOAL_NOT_FOUND` (algum `metaId` não é de uma meta do usuário: também **nada** é aplicado).

**Cartão e parcelas na edição.** `cartaoId` (`null` desvincula) e `parcelas` também podem ser alterados, com estas regras:

- Só valem se a forma de pagamento **final** for crédito (senão `400 VALIDATION_ERROR`, e nada é gravado). Mudar a forma para outra que não seja crédito apaga cartão, parcelas e o parcelamento.
- À vista para parcelada cria o parcelamento; parcelada para à vista (`parcelas: 1`) o remove; mudar valor, parcelas, cartão ou descrição de uma parcelada atualiza o **mesmo** parcelamento.
- Se o parcelamento já tem **parcelas pagas**, o valor, o número de parcelas e a remoção são recusados (`409 INSTALLMENT_IN_PROGRESS`); só o cartão e a descrição podem mudar.
- `cartaoId` de cartão inexistente ou de outro usuário: `404 CARD_NOT_FOUND` e o lote inteiro é recusado.

### 2.7 Excluir transações

`POST /v1/transactions/bulk-delete` → `200 OK` (é `POST` porque um `DELETE` com corpo não é confiável em todos os clientes). Também vale um lote de um id só.

```json
{ "ids": ["6ae4a14014fb37bcbb2d7fac", "6ae4a14014fb37bcbb2d7fad"] }
```

A resposta tem o mesmo formato da edição (`afetadas` e `naoEncontradas`). Excluir uma compra parcelada exclui também o parcelamento ligado a ela. Excluir um id que já foi excluído o devolve em `naoEncontradas`.

Erros: `400 VALIDATION_ERROR` (lista vazia, mais de 100 ids, ids repetidos ou mal formados) e `401 UNAUTHENTICATED`.

### 2.8 Contas conectadas e importação (Pluggy) — `/v1/connected-accounts`

O usuário conecta uma conta bancária do **sandbox da Pluggy** (instituições e dados fictícios) e o Backend importa as transações dela. Só o Backend fala com a Pluggy: a chave (`PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`, em `Backend/.env`) é **uma só, compartilhada pelo time**, e nunca vai para o Frontend nem para o Git. Todas as rotas exigem token, e cada usuário só vê e altera as próprias contas.

**Objeto `ConnectedAccount`**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador da conexão |
| `instituicao` | texto | Nome da instituição (por exemplo, `Pluggy Bank`) |
| `status` | texto | Status do item na Pluggy: `UPDATED` (pronta), `UPDATING` (sincronizando), `LOGIN_ERROR`, `OUTDATED`... |
| `contas` | lista | As contas da conexão: `{ id, tipo, nome, saldo?, moeda? }`. `tipo` é `BANK` (corrente) ou `CREDIT` (cartão) |
| `ultimaSincronizacao` | texto (ISO 8601) | Quando as transações foram importadas pela última vez. **Só aparece depois da primeira importação** |
| `criadaEm` | texto (ISO 8601) | Quando a conexão foi criada |

**Rotas**

| Método e rota | O que faz | Resposta |
|---|---|---|
| `GET /v1/connected-accounts` | Lista as contas conectadas do usuário | `200` com a lista de `ConnectedAccount` |
| `POST /v1/connected-accounts/sandbox` | Conecta o conector de teste **Pluggy Bank** (credenciais públicas do sandbox), sem widget, e já importa | `201` com `{ conta, importacao }` |
| `POST /v1/connected-accounts/connect-token` | Pede o token para o Frontend abrir o widget **Pluggy Connect** | `200` com `{ accessToken }` |
| `POST /v1/connected-accounts` com `{ "itemId": "<uuid>" }` | Registra o item criado pelo widget e já importa | `201` com `{ conta, importacao }` |
| `POST /v1/connected-accounts/:id/sync` | Importa de novo (traz só as transações novas) | `200` com o resultado da importação |
| `DELETE /v1/connected-accounts/:id` | Desconecta: remove a conexão e o item na Pluggy. **As transações já importadas continuam**, só param de chegar novas | `204` |

Se a importação falhar logo depois de conectar (por exemplo, a instituição ainda está sincronizando), a resposta de conectar é `201` com `"importacao": null` e `"avisoImportacao": { code, message }`: a conta fica conectada e dá para importar depois com `/sync`.

**Resultado da importação**

```json
{
  "lidas": 48,
  "importadas": 47,
  "ignoradas": { "duplicadas": 0, "pendentes": 0, "zeradas": 0, "faturaCartao": 1, "invalidas": 0 }
}
```

`lidas` = `importadas` + a soma das `ignoradas`.

**Como as transações são importadas**
- **Receita ou despesa vem do sinal do valor** na Pluggy (negativo = despesa), não do tipo dela: no cartão, as compras vêm como `CREDIT` com valor negativo. O `valor` gravado é sempre positivo.
- **O pagamento da fatura do cartão não é importado** (`faturaCartao`): ele aparece na conta corrente e as compras já estão no cartão, então contar os dois dobraria o gasto.
- Transações **pendentes** (ainda não confirmadas pelo banco) e de valor zero também são ignoradas.
- Cada transação importada entra com `origem: "pluggy"` e uma **categoria pedida ao Servidor** (`PedidoCategorizarTransacao`); se o Servidor estiver fora do ar, a categoria é `Outros` e a importação não falha.
- A forma de pagamento vem do `paymentData` (boleto), do `operationType` (Pix) ou da conta (cartão = `credito`); senão `outro`.
- **Não se repete:** o `id` da Pluggy fica guardado e a mesma transação nunca entra duas vezes para o mesmo usuário (um índice único garante isso até com duas sincronizações ao mesmo tempo).
- O `paymentData` da Pluggy (nome e CPF de terceiros) **nunca é gravado**.

**Segurança.** O item da Pluggy é criado com o `clientUserId` do usuário. Ao registrá-lo, o Backend confere que ele pertence a quem está pedindo: sem isso, qualquer usuário poderia "adotar" o item de outro. Cada usuário pode ter **até 5 contas conectadas**.

**Erros**

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `itemId` que não é um UUID, ou `:id` mal formado |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 403 | `PLUGGY_ITEM_NOT_OWNED` | O item não é do usuário (ou não tem dono) |
| 404 | `NOT_FOUND` | A conta conectada não existe ou é de outro usuário |
| 404 | `PLUGGY_NOT_FOUND` | O item não existe na Pluggy |
| 409 | `ACCOUNT_ALREADY_CONNECTED` | O item já está conectado |
| 409 | `PLUGGY_SYNC_IN_PROGRESS` | A instituição ainda está sincronizando; tente de novo em instantes |
| 422 | `ACCOUNT_LIMIT_REACHED` | O usuário já tem 5 contas conectadas |
| 422 | `PLUGGY_ITEM_ERROR` | A conexão com a instituição precisa ser refeita (por exemplo, `LOGIN_ERROR`) |
| 422 | `PLUGGY_REJECTED` | A Pluggy recusou o pedido |
| 502 | `PLUGGY_ERROR` / `PLUGGY_AUTH_FAILED` | Erro na Pluggy, ou as credenciais do sistema foram recusadas |
| 503 | `PLUGGY_UNAVAILABLE` | A Pluggy está fora do ar ou demorou demais |
| 503 | `PLUGGY_NOT_CONFIGURED` | Faltam `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` no `.env` do Backend |

**Coleção `connected_accounts` (MongoDB)**

| Campo | Tipo | Descrição |
|---|---|---|
| `userId` | texto | Dono da conexão |
| `pluggyItemId` | texto | Id do item na Pluggy |
| `connectorId` | número | Conector da Pluggy (`2` = Pluggy Bank, do sandbox) |
| `instituicao`, `status` | texto | Nome da instituição e status do item |
| `contas` | lista | `{ pluggyAccountId, tipo, nome, saldo?, moeda? }` da última sincronização |
| `ultimaSincronizacao` | data | Última importação |

Índices: `userId` e `pluggyItemId` **único** (um item pertence a um só usuário). Nas `transactions`, as importadas têm também `externalId` (o id da Pluggy) e `contaConectadaId`, com um índice **único parcial** `{ userId, externalId }`. Seed de exemplo: `npm run seed:contas`.

### 2.9 Duplicar transação

`POST /v1/transactions/:id/duplicate` → `201 Created`, com o objeto `Transaction` **novo**. Serve de ponto de partida para lançamentos parecidos ou recorrentes.

O corpo é **opcional**:

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `data` | texto (data ou ISO 8601) | Não | Data do novo lançamento. Sem ela, vale o momento da chamada |

A cópia leva `tipo`, `valor`, `categoria`, `descricao`, `observacoes`, `formaPagamento` e a **meta** (`metaId`, se houver) do original, com `origem: "manual"` e um `id` novo: duplicar um aporte gera outro aporte para a mesma meta. O original **não muda**. O cartão e as parcelas também são copiados; uma compra parcelada ganha o **próprio** parcelamento novo (o do original continua dele). O Servidor Java não é chamado: a categoria é a do original.

Só lançamentos **manuais** podem ser duplicados.

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `id` mal formado ou `data` inválida |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 404 | `TRANSACTION_NOT_FOUND` | A transação não existe ou é de outro usuário (os dois casos são tratados igual) |
| 422 | `DUPLICATE_NOT_ALLOWED` | A transação foi importada da Pluggy (`origem: "pluggy"`) |

---

## 3. Mentor financeiro (IA) — `/v1/mentor-ia` (Grupo 4)

Todas as rotas exigem token. O chat usa as **transações do mês atual** do usuário (do dia 1 até hoje, no horário de Brasília) para responder; quanto mais transações cadastradas, melhor a resposta.

Regras que valem para toda resposta da IA:
- É **educacional**: explica gastos, orçamento e conceitos. Não substitui um consultor.
- **Só fala de finanças pessoais** (gastos e receitas, orçamento, dívidas, cartão, reserva de emergência, conceitos de investimento). Pedidos de outro assunto (programação, exercícios, redação, curiosidades...) e respostas com **código** viram uma recusa padrão: "Sou o Mentor Financeiro do FinanceAI e só posso ajudar com finanças pessoais: ... Quer conversar sobre algum desses temas?". A recusa é salva no histórico como uma resposta comum.
- **Nunca recomenda comprar, vender ou aportar em um ativo específico** (ação, fundo, criptomoeda, título). A resposta passa por um filtro no Servidor de cálculos: a frase que recomenda um ativo é removida e um aviso é acrescentado no final.
- Os números citados (totais, percentuais por categoria, média diária) são calculados pelo Servidor de cálculos, não pela IA.

### 3.1 Objeto `ChatMessage`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador da mensagem |
| `autor` | `"usuario"` ou `"ia"` | Quem escreveu |
| `texto` | texto | Conteúdo. O da IA pode ter **markdown simples** (`**negrito**`, listas com `-`): o Frontend pode mostrar como texto puro ou converter |
| `proativa` | `true` (opcional) | Só aparece nas mensagens que o Mentor mandou sozinho, explicando padrões identificados (seção 3.8). Nas demais mensagens o campo **não vem** (trate ausência como `false`) |
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

As mensagens proativas (seção 3.8) também aparecem no histórico, com `"proativa": true`, na ordem em que foram criadas.

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

### 3.8 Mensagem proativa do Mentor

`POST /v1/mentor-ia/chat/proativa` → `200 OK`, sem corpo na requisição. Faz o Mentor **iniciar a conversa** explicando, em linguagem natural, os padrões identificados nas transações do usuário, sem esperar uma pergunta.

**Quando chamar:** ao abrir a tela do chat, logo depois de carregar o histórico (`GET /chat`). Se vier uma mensagem, acrescente-a no fim da conversa. A chamada pode ser **silenciosa**: em caso de erro, basta ignorar (o chat continua funcionando e o Backend tenta de novo na próxima abertura).

**O que é um padrão:** cada alerta **não lido** (seção 3.5) que o Mentor **ainda não explicou**. A rota recalcula os alertas como `GET /alerts` e:
- **Sem padrão novo**, devolve `{ "mensagens": [] }` na hora, sem chamar a IA nem o Servidor de cálculos. É o caso mais comum: cada alerta é explicado **uma única vez**, então chamar de novo devolve `[]` até surgir um padrão novo (por exemplo, um gasto fora do padrão).
- **Com padrão novo**, a IA escreve **uma** mensagem curta (até 2 parágrafos ou uma lista) que explica todos os padrões novos juntos, com os números deles, e termina com uma pergunta ou um convite para continuar a conversa. A mensagem passa pelo mesmo filtro de ativos do chat, é salva no histórico (objeto `ChatMessage` com `autor: "ia"` e `proativa: true`) e devolvida em `mensagens`. Os alertas explicados continuam aparecendo em `GET /alerts` até serem marcados como lidos.

A instrução interna que pede a explicação **não é salva** no histórico: o usuário vê só a mensagem da IA. Como no `POST /chat`, a resposta demora alguns segundos quando há padrão novo.

Resposta `200` com padrão novo:

```json
{
  "mensagens": [
    {
      "id": "6af1be0a9322b6d9b51951ce",
      "autor": "ia",
      "texto": "**Padrões identificados no seu fluxo financeiro**\n\n- **Gasto fora do padrão em Alimentação:** Você já gastou **R$ 2.070,85** em alimentação neste mês, o que é **3,2 vezes** o maior gasto mensal dessa categoria nos últimos três meses (máximo de **R$ 647,40**). ...\n- **Dinheiro parado na conta:** Desde 01/08, o saldo acumulado sem uso chegou a **R$ 7.083,00**, valor que supera em muito seu gasto médio mensal (**R$ 1.664,68**). ...\n- **Fatura do cartão perto do vencimento:** Amanhã (10/11) vence a fatura de **R$ 434,70** referente a compras feitas de 03/10 a 02/11. ...\n\nComo podemos trabalhar juntos para equilibrar esses pontos e melhorar seu orçamento? Estou aqui para ajudar no que precisar.",
      "proativa": true,
      "criadaEm": "2026-11-09T12:35:22.831Z"
    }
  ]
}
```

(Capturado em 09/11/2026 com os dados do seed mais uma despesa de R$ 1.500 em `Alimentacao`; trechos encurtados com `...`.)

Resposta `200` sem padrão novo (sem alertas, ou todos já explicados):

```json
{ "mensagens": [] }
```

`mensagens` é sempre uma lista, com 0 ou 1 mensagem.

**Duas abas ao mesmo tempo:** se duas chamadas chegarem juntas, só uma delas salva a explicação; a outra devolve `[]`. Se o Mentor já explicou parte dos padrões enquanto a outra chamada esperava a IA, pode sair uma segunda mensagem repetindo esses padrões junto com o novo (caso raro, aceito).

Erros (os mesmos de `POST /chat`; em todos, nada é salvo e os padrões continuam sem explicação, para a próxima abertura):

| Status | `code` | Quando |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 429 | `GENAI_RATE_LIMITED` | Acabou o limite de uso gratuito da API de IA |
| 502 | `GENAI_ERROR` | A API de IA respondeu com erro ou sem conteúdo |
| 503 | `GENAI_UNAVAILABLE` | A API de IA está fora do ar, demorou mais de 20 s ou não foi configurada no Backend |
| 503 | `JAVA_SERVER_UNAVAILABLE` | O Servidor de cálculos está fora do ar |

---

## 4. Dados de exemplo (seed)

Para desenvolver sem digitar tudo, o Backend tem um script que insere cerca de 33 transações dos últimos 3 meses (receitas, despesas, várias categorias e formas de pagamento), com datas relativas a hoje. Na pasta `Backend`, com a `MONGO_URI` no `.env`:

```bash
npm run seed:transacoes                        # para o usuário "usuario-demo"
npm run seed:transacoes -- <userId>            # para um usuário específico
npm run seed:transacoes -- <userId> --limpar   # apaga antes as transações desse usuário
npm run seed:contas                            # contas conectadas de exemplo (usuario-demo); aceita <userId> e --limpar
npm run seed:grupo5                            # metas, ativos, cartão e parcelamentos de exemplo (usuario-demo); aceita <userId> e --limpar
```

Sem `--limpar`, rodar de novo **acrescenta** mais transações. Use o `userId` que está dentro do seu token para ver os dados pela API.

---

## 5. Metas financeiras — `/v1/goals` (Grupo 5)

Todas as rotas exigem token, e cada usuário só vê e altera as próprias metas. O **progresso não é guardado**: é calculado a cada leitura, para refletir as edições e exclusões feitas no extrato.

- `valorAtual` = `valorInicial` + a soma do valor das **transações que o usuário vinculou àquela meta** (os aportes). Qualquer transação pode ser vinculada, e o **tipo define o sentido**: uma **despesa** vinculada **soma** (o usuário guardou o dinheiro) e uma **receita** vinculada **subtrai** (retirou da meta). O total pode ficar negativo se saiu mais do que entrou; nesse caso o percentual é 0. Transações **sem vínculo não contam**, as com data no futuro ainda não contam, e as de outro usuário nunca contam. Cada meta tem o seu próprio total: o aporte de uma não aparece na outra.
- O vínculo é feito ao cadastrar ou editar a transação (`metaId`, seções 2.4 e 2.6). Excluir a transação tira o aporte do progresso; excluir a **meta** desvincula as transações dela (elas continuam no extrato, sem `metaId`).
- O percentual, o que falta, os dias e meses restantes e o aporte mensal são calculados pelo **Servidor de cálculos** (`PedidoProgressoMeta`). Se ele estiver fora do ar, a rota responde `503 JAVA_SERVER_UNAVAILABLE` e **nada é salvo** (o cálculo vem antes da gravação).

### 5.1 Objeto `Goal`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador da meta |
| `titulo` | texto | Nome da meta (1 a 100 caracteres) |
| `valorObjetivo` | número | Quanto quer juntar (maior que zero) |
| `valorInicial` | número | Quanto já tinha guardado ao criar a meta (0 ou mais; padrão `0`) |
| `prazo` | texto (ISO 8601) | **Opcional.** Até quando (ao criar, ou ao mudar o prazo, não pode estar no passado). Meta sem prazo: `prazo`, `diasRestantes`, `mesesRestantes` e `aporteMensalNecessario` não vêm e `noPrazo` é sempre `true` |
| `valorAtual` | número | `valorInicial` + `valorAportado` |
| `valorAportado` | número | Despesas vinculadas menos receitas vinculadas (pode ser negativo) |
| `quantidadeAportes` | inteiro | Quantas transações estão vinculadas à meta |
| `percentual` | número | De 0 a 100, com 2 casas |
| `falta` | número | O que ainda falta para o objetivo (0 se atingido) |
| `concluida` | booleano | `valorAtual` ≥ `valorObjetivo` |
| `noPrazo` | booleano | Concluída, ou o prazo ainda não passou (o próprio dia do prazo conta como dentro) |
| `diasRestantes` | inteiro | Dias até o prazo (0 se já venceu) |
| `mesesRestantes` | inteiro | `ceil(diasRestantes / 30)`, no mínimo 1 |
| `aporteMensalNecessario` | número | `falta / mesesRestantes` (0 se concluída) |
| `criadaEm` | texto (ISO 8601) | Quando a meta foi criada |

Exemplo (meta de R$ 10.000 com R$ 5.000 já guardados e prazo daqui a 181 dias):

```json
{
  "id": "6ad3fd7c273f8f0946dd77e5",
  "titulo": "Viagem",
  "valorObjetivo": 10000,
  "valorInicial": 5000,
  "prazo": "2027-05-14T00:00:00.000Z",
  "valorAtual": 5000,
  "valorAportado": 0,
  "quantidadeAportes": 0,
  "percentual": 50,
  "falta": 5000,
  "concluida": false,
  "noPrazo": true,
  "diasRestantes": 181,
  "mesesRestantes": 7,
  "aporteMensalNecessario": 714.29,
  "criadaEm": "2026-11-14T20:41:28.511Z"
}
```

### 5.2 Rotas

| Método e rota | O que faz | Resposta |
|---|---|---|
| `GET /v1/goals` | Lista as metas do usuário, com o prazo mais próximo primeiro (as sem prazo no fim), já com o progresso | `200` com a lista de `Goal` (vazia se não há metas) |
| `POST /v1/goals` | Cria uma meta. Corpo: `titulo`, `valorObjetivo` (obrigatórios); `valorInicial` e `prazo` (opcionais) | `201` com a `Goal` |
| `GET /v1/goals/:id` | Uma meta | `200` com a `Goal` |
| `PATCH /v1/goals/:id` | Edita só os campos enviados (`titulo`, `valorObjetivo`, `valorInicial`, `prazo`). Um prazo novo não pode estar no passado; `prazo: null` tira o prazo da meta; editar outros campos de uma meta já vencida não exige mudar o prazo | `200` com a `Goal` recalculada |
| `DELETE /v1/goals/:id` | Exclui a meta e **desvincula** as transações dela (`metaId` é removido; as transações **não** são apagadas) | `204` |

### 5.3 Erros

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Campo inválido (título vazio ou com mais de 100 caracteres, valor objetivo zero ou negativo, valor inicial negativo, prazo inválido ou no passado, `PATCH` sem nenhum campo, `:id` mal formado). Os campos de formato errado vêm em `details` |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 404 | `GOAL_NOT_FOUND` | A meta não existe ou é de outro usuário (os dois casos são tratados igual) |
| 503 | `JAVA_SERVER_UNAVAILABLE` | O Servidor de cálculos está fora do ar |

### 5.4 Mensagem ao Servidor de cálculos

`PedidoProgressoMeta` → `RespostaProgressoMeta`. O pedido leva `valorAtual`, `valorObjetivo` e `prazo` (ISO 8601); a resposta traz `percentual`, `falta`, `concluida`, `noPrazo`, `diasRestantes`, `mesesRestantes` e `aporteMensalNecessario` (os mesmos nomes do objeto `Goal`). O pedido aceita ainda um `hoje` opcional, só para os testes fixarem o dia.

**Coleção `goals` (MongoDB):** `userId`, `titulo`, `valorObjetivo`, `valorInicial`, `prazo` (opcional) e os carimbos de data. Índice `{ userId, prazo }`. O vínculo fica na coleção `transactions`, no campo `metaId` (índice `{ userId, metaId }`): é a soma dessas transações que dá o `valorAportado`.

---

## 6. Investimentos e cartão simulados — `/v1/investments` (Grupo 5)

Módulo **complementar** e **simulado**: os ativos, o cartão e os parcelamentos são fictícios, para o usuário acompanhar e aprender. Todas as rotas exigem token, e cada usuário só vê e altera os próprios dados. Valor atual, rendimento, parcela, saldo devedor e fatura **não são guardados**: o Servidor de cálculos faz as contas a cada leitura (`PedidoRentabilidadeSimulada` e `PedidoCalcularParcelamentos`). Com ele fora do ar, as rotas respondem `503 JAVA_SERVER_UNAVAILABLE` e nada é salvo.

### 6.1 Portfólio e patrimônio (feature futura: sem tela)

> As rotas desta seção existem, funcionam e têm testes, mas o Frontend **não tem tela de portfólio**: a aba `#cartao` mostra só o cartão e os parcelamentos (6.2 e 6.3). O portfólio ficou como feature futura.

**Objeto `Investment`**

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador do ativo |
| `nome` | texto | Nome (1 a 100 caracteres) |
| `tipo` | texto | `renda_fixa`, `renda_variavel`, `fundo`, `cripto` ou `outro` (padrão) |
| `valorInvestido` | número | Quanto foi aplicado (maior que zero) |
| `taxaMensal` | número | Rentabilidade simulada em **% ao mês** (acima de −100 e até 100; padrão `0`). É também a "rentabilidade do último mês" |
| `dataAplicacao` | texto (ISO 8601) | Quando foi aplicado (padrão: hoje) |
| `mesesRendendo` | inteiro | Meses **completos** desde a aplicação (o dia 15 só completa o mês no dia 15 seguinte) |
| `valorAtual` | número | `valorInvestido × (1 + taxaMensal/100) ^ mesesRendendo` (juros compostos) |
| `rendimento` | número | `valorAtual − valorInvestido` |
| `rentabilidade` | número | Rendimento em % sobre o valor investido, desde a aplicação |
| `percentualCarteira` | número | Participação do ativo no patrimônio total, em % |

| Método e rota | O que faz | Resposta |
|---|---|---|
| `GET /v1/investments` | Portfólio e patrimônio | `200` com `{ ativos, totalInvestido, patrimonio, rendimento, rentabilidade }` (zeros se não há ativos). O `patrimonio` é a soma dos `valorAtual` |
| `POST /v1/investments` | Cadastra um ativo. Corpo: `nome`, `valorInvestido` (obrigatórios); `tipo`, `taxaMensal`, `dataAplicacao` (opcionais) | `201` com o `Investment` (o `percentualCarteira` já considera os ativos que existiam) |
| `DELETE /v1/investments/:id` | Remove um ativo | `204` |

### 6.2 Cartões de crédito simulados

Cada usuário pode ter **até 5 cartões**, cada um com `nome` (1 a 40 caracteres, único por usuário sem diferenciar maiúsculas), `limite` e `diaVencimento`. Quem ainda não tem cartão recebe um chamado **Cartão** (limite de R$ 5.000, vencimento no dia 10) na primeira leitura. O cartão **mais antigo** é o **padrão**: recebe as compras no crédito sem `cartaoId` e os parcelamentos sem `cartaoId`.

| Método e rota | O que faz | Resposta |
|---|---|---|
| `GET /v1/investments/cards` | Lista os cartões, cada um com a sua fatura e o seu limite | `200` com `{ cartoes: [Card] }` (o mais antigo primeiro) |
| `POST /v1/investments/cards` | Cria um cartão. Corpo: `nome` obrigatório; `limite` (maior que zero, padrão 5000) e `diaVencimento` (inteiro de 1 a 28, padrão 10) opcionais | `201` com o `Card` |
| `GET /v1/investments/cards/:id` | Um cartão | `200` com o `Card` |
| `PATCH /v1/investments/cards/:id` | Altera `nome`, `limite` e/ou `diaVencimento` | `200` com o `Card` |
| `DELETE /v1/investments/cards/:id` | Exclui o cartão. As transações dele ficam, sem o vínculo. **Recusa se houver parcelamento em andamento** (`409 CARD_HAS_INSTALLMENTS`) | `204` |
| `GET /v1/investments/card` e `PATCH /v1/investments/card` | Rotas antigas: valem para o **cartão padrão** | `200` com o `Card` |

```json
{
  "id": "6ae4a14014fb37bcbb2d7fac",
  "nome": "Nubank",
  "padrao": true,
  "limite": 8000,
  "diaVencimento": 10,
  "limiteDisponivel": 1833.78,
  "saldoDevedor": 4878.36,
  "parcelamentosAtivos": 2,
  "fatura": {
    "mes": "2026-11",
    "valor": 1287.86,
    "comprasNoCredito": 256.8,
    "parcelasDoMes": 1031.06,
    "vencimento": "2026-12-10",
    "diasParaVencer": 26
  }
}
```

- `comprasNoCredito`: soma das **despesas reais à vista** do usuário, no crédito **neste cartão**, no mês corrente (UTC), até agora. Receitas, outras formas de pagamento e outros meses não entram, e as compras **parceladas** também não (elas entram pelas parcelas).
- `parcelasDoMes`: soma das parcelas dos parcelamentos **ainda ativos deste cartão** (6.3).
- `fatura.valor` = `comprasNoCredito` + `parcelasDoMes`: uma compra nunca é contada duas vezes.
- `vencimento`: o próximo dia de vencimento (neste mês, ou no seguinte se o dia já passou; o próprio dia ainda vale).
- `limiteDisponivel` = `limite` − `comprasNoCredito` − `saldoDevedor` (dos parcelamentos do cartão). Pode ficar **negativo** se o limite estourar.
- **Migração:** quem tinha um cartão único (versão anterior) continua com ele, que passa a se chamar **Cartão**; os parcelamentos antigos ficam nele. O Backend faz isso ao subir, de forma idempotente.

### 6.3 Parcelamentos ativos

**Parcelas pelo calendário:** `parcelasPagas` avança sozinho, uma por mês (contado a partir da data da compra, ou de quando o parcelamento foi criado): vale o maior entre o valor gravado e os meses já passados, até o total (a parcela do mês corrente é a atual e entra na fatura). Um parcelamento que o tempo quitou deixa de impedir a exclusão do cartão.

**Objeto `Installment`:** `id`, `cartaoId` (o cartão a que pertence), `transacaoId` (só nos criados a partir de uma compra parcelada, 2.4), `descricao`, `valorTotal`, `parcelas`, `parcelasPagas`, `taxaJurosMensal` (em % ao mês, 0 = sem juros) e os valores calculados `valorParcela`, `parcelasRestantes`, `saldoDevedor`, `jurosTotal` e `quitado`.

- Parcela pela **tabela Price**: `valorTotal × i / (1 − (1+i)^−parcelas)`, com `i = taxaJurosMensal/100`; sem juros, `valorTotal / parcelas`.
- `saldoDevedor`: o valor presente das parcelas que faltam (o que seria preciso pagar hoje para quitar); 0 se quitado.
- `jurosTotal`: `valorParcela × parcelas − valorTotal`.

| Método e rota | O que faz | Resposta |
|---|---|---|
| `GET /v1/investments/card/installments` | Lista os parcelamentos com os totais; `?cartaoId=` mostra só os de um cartão | `200` com `{ parcelamentos, totalParcelasDoMes, totalSaldoDevedor, totalJuros }` (os totais só somam os ainda ativos) |
| `POST /v1/investments/card/installments` | Cadastra. Corpo: `descricao`, `valorTotal`, `parcelas` (de 1 a 120) obrigatórios; `cartaoId` opcional (sem ele, vai para o cartão padrão); `parcelasPagas` (0 até `parcelas`) e `taxaJurosMensal` (0 a 100) opcionais | `201` com o `Installment` |
| `PATCH /v1/investments/card/installments/:id` | Altera a `descricao` e/ou `parcelasPagas` (não pode passar do total). Pagar uma parcela é enviar `parcelasPagas + 1` | `200` com o `Installment` recalculado |
| `DELETE /v1/investments/card/installments/:id` | Remove o parcelamento. Os criados por uma compra parcelada só saem excluindo a transação (`409 INSTALLMENT_FROM_TRANSACTION`) | `204` |

### 6.4 Erros

| Status | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Campo inválido (nome, valor, taxa ou data inválidos; tipo desconhecido; dia fora de 1 a 28; parcelas fora de 1 a 120; parcelas pagas acima do total; corpo sem nenhum campo conhecido; `:id` mal formado). Os campos errados vêm em `details` |
| 401 | `UNAUTHENTICATED` | Sem token ou token inválido |
| 404 | `INVESTMENT_NOT_FOUND` | O ativo não existe ou é de outro usuário |
| 404 | `INSTALLMENT_NOT_FOUND` | O parcelamento não existe ou é de outro usuário |
| 404 | `CARD_NOT_FOUND` | O cartão não existe ou é de outro usuário |
| 409 | `CARD_LIMIT_REACHED` | O usuário já tem 5 cartões |
| 409 | `CARD_NAME_TAKEN` | Já existe um cartão com esse nome |
| 409 | `CARD_HAS_INSTALLMENTS` | O cartão tem parcelamentos em andamento: quite ou exclua antes |
| 409 | `INSTALLMENT_FROM_TRANSACTION` | O parcelamento veio de uma compra: exclua a transação |
| 503 | `JAVA_SERVER_UNAVAILABLE` | O Servidor de cálculos está fora do ar |

### 6.5 Mensagens ao Servidor de cálculos e coleções

- `PedidoRentabilidadeSimulada`: `ativos` (cada um com `id`, `nome`, `tipo`, `valor`, `taxaMensal` e `meses`) → `RespostaRentabilidadeSimulada`: os mesmos ativos com `valorAtual`, `rendimento`, `rentabilidade` e `percentualCarteira`, mais `totalInvestido`, `patrimonio`, `rendimento` e `rentabilidade`.
- `PedidoCalcularParcelamentos`: `parcelamentos` (cada um com `id`, `descricao`, `valorTotal`, `parcelas`, `parcelasPagas` e `taxaJurosMensal`) → `RespostaCalcularParcelamentos`: os mesmos com `valorParcela`, `parcelasRestantes`, `saldoDevedor`, `jurosTotal` e `quitado`, mais `totalParcelasDoMes`, `totalSaldoDevedor` e `totalJuros`.
- **Coleções (MongoDB):** `investments` (`userId`, `nome`, `tipo`, `valorInvestido`, `taxaMensal`, `dataAplicacao`), `cards` (`userId`, `nome` **único por usuário**, `limite`, `diaVencimento`) e `card_installments` (`userId`, `cartaoId`, `transacaoId`, `descricao`, `valorTotal`, `parcelas`, `parcelasPagas`, `taxaJurosMensal`).

---

## 7. Suporte — `/v1/suporte` (Grupo 1)

O módulo de suporte permite que usuários autenticados reportem problemas encontrados durante a utilização do FinanceAI.

Todas as requisições exigem token JWT. O Backend identifica o usuário pelo token, sem receber seu identificador no corpo da requisição.

### 7.1 Reportar problema

`POST /v1/suporte` → `201 Created`

O endpoint recebe os dados preenchidos no formulário de suporte, valida as informações e registra o relatório no MongoDB.

| Campo | Tipo | Obrigatório | Regra |
|-------|------|-------------|-------|
| `assunto` | texto | Sim | De 1 a 100 caracteres, após remover espaços nas pontas |
| `categoria` | texto | Sim | Uma das categorias disponíveis |
| `descricao` | texto | Sim | Pelo menos 10 caracteres, após remover espaços nas pontas |

**Categorias disponíveis:**

- `erro-tecnico`
- `conta-acesso`
- `plano`
- `outros`

**Exemplo de requisição:**

```json
{
  "assunto": "Problema com o plano",
  "categoria": "plano",
  "descricao": "Não consigo pagar o plano Pro."
}
```

**Resposta `201`:**

```json
{
  "mensagem": "Problema reportado com sucesso!",
  "relatorio": {
    "id": "6ad3fd7c273f8f0946dd77e5",
    "assunto": "Problema com o plano",
    "categoria": "plano",
    "descricao": "Não consigo pagar o plano Pro.",
    "status": "aberto",
    "createdAt": "2026-11-17T15:00:00.000Z"
  }
}
```

*O identificador e a data apresentados são ilustrativos.*

O campo `status` é inicialmente definido como `aberto`. O usuário recebe a confirmação de envio após o registro do relatório.

**Erros:**

| Status | `code` | Quando |
|--------|--------|--------|
| 400 | `VALIDATION_ERROR` | Assunto ausente ou com mais de 100 caracteres, categoria inválida ou descrição com menos de 10 caracteres |
| 401 | `UNAUTHENTICATED` | Token ausente, inválido ou expirado |
| 500 | `INTERNAL_ERROR` | Falha inesperada no servidor |

Os códigos acima seguem as convenções gerais do contrato. Seu retorno efetivo depende do tratamento global de erros do Backend.

### 7.2 Armazenamento no MongoDB

Os relatórios são registrados na coleção `suportes`.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `usuarioId` | identificador | Usuário responsável pelo relatório, obtido pelo token JWT |
| `assunto` | texto | Assunto informado pelo usuário |
| `categoria` | texto | Categoria selecionada |
| `descricao` | texto | Descrição detalhada do problema |
| `status` | texto | Situação do relatório, inicialmente `aberto` |
| `createdAt` | data | Data de criação do relatório |
| `updatedAt` | data | Data da última atualização |

**Índices da coleção `suportes`:**

- `_id_`: índice único criado automaticamente pelo MongoDB.
- `usuarioId_1`: índice crescente no campo `usuarioId`, utilizado para otimizar consultas dos relatórios por usuário.

O usuário autenticado é identificado automaticamente pelo Backend, garantindo a associação do relatório à conta responsável pelo envio.

### 7.3 Integração com o Frontend

O formulário está disponível em **Minha conta → Visão geral → Reportar problema**.

Ao enviar o formulário:
O Frontend envia `assunto`, `categoria` e `descricao` para `POST /v1/suporte`.
O Backend valida os campos e identifica o usuário autenticado.
O relatório é armazenado na coleção `suportes`.
A API retorna `201 Created` com os dados do relatório.
O Frontend apresenta a mensagem **"Problema reportado com sucesso!"** e mantém o usuário na página.

Em caso de falha, o Frontend informa que não foi possível enviar o relatório.
