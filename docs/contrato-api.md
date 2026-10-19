# Contrato da API do FinanceAI

Documento vivo que descreve **o que o Backend aceita e devolve**. É a referência do Frontend e dos outros grupos. Os exemplos de resposta foram capturados da API em funcionamento, não escritos à mão.

**Regra do grupo:** quem cria ou muda uma rota atualiza este documento **no mesmo Pull Request** do código.

## Estado por módulo

| Módulo | Prefixo | Grupo | Estado |
|---|---|---|---|
| Sistema | `/v1/health`, `/v1/eco` | Todos | Documentado (seção 1.6) |
| Transações | `/v1/transactions` | 2 | **Cadastro e listagem (com filtros e paginação) documentados** (seção 2); edição, exclusão, duplicação e importação planejadas |
| Autenticação e conta | `/v1/auth` | 1 | A documentar |
| Painel e análise | `/v1/dashboard` | 3 | A documentar |
| Mentor financeiro (IA) | `/v1/mentor-ia` | 4 | A documentar |
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
| `categoria` | texto | Categoria (ver 2.3). Se não for enviada no cadastro, vale `"Outros"` |
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
| `categoria` | texto | Não | Se faltar, vale `"Outros"` |
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

### 2.6 Rotas planejadas (ainda não existem)

| Método e rota | Para quê | Issue |
|---|---|---|
| `PUT /v1/transactions/:id` | Editar uma transação, incluindo a categoria | #35 |
| `DELETE /v1/transactions/:id` | Excluir | A definir |
| `POST /v1/transactions/:id/duplicate` | Duplicar um lançamento | #49 |
| `POST /v1/transactions/import` | Importar do sandbox da Pluggy | #46 |

---

## 3. Dados de exemplo (seed)

Para desenvolver sem digitar tudo, o Backend tem um script que insere cerca de 33 transações dos últimos 3 meses (receitas, despesas, várias categorias e formas de pagamento), com datas relativas a hoje. Na pasta `Backend`, com a `MONGO_URI` no `.env`:

```bash
npm run seed:transacoes                        # para o usuário "usuario-demo"
npm run seed:transacoes -- <userId>            # para um usuário específico
npm run seed:transacoes -- <userId> --limpar   # apaga antes as transações desse usuário
```

Sem `--limpar`, rodar de novo **acrescenta** mais transações. Use o `userId` que está dentro do seu token para ver os dados pela API.
