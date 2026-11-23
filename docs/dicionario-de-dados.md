# Dicionário de Dados: Projeto FinanceAI (plataforma de gestão financeira pessoal com IA, PI4 — PUC-Campinas, grupo G18)

## 1. Histórico de versões (ou revisões)

| Data | Autor | Versão | Comentários |
| :---: | :---: | ---: | :--- |
| 22/11/2026 | Grupo G18 | 1.0.0 | Coleção `accounts` (contas manuais e Open Finance); `contaId`/`contaDestinoId` nas transações (transferências) e `contaId` nos cartões; `contaDispensada` na conexão. Dicionário completo, com tipos compostos, desdobramento em MongoDB, comparação relacional e consultas/índices |
| 19/11/2026 | Grupo G18 | 0.9.0 | Vários cartões por usuário: `cards` ganha `nomeChave`, único por usuário; `cartaoId`, `parcelas` e `parcelamentoId` nas transações |
| 17/11/2026 | Grupo G18 | 0.8.0 | Coleção `suportes` (chamados de suporte) |
| 15/11/2026 | Grupo G18 | 0.7.0 | Coleções `goals` (metas), `investments`, `cards` (cartão) e `card_installments` (parcelamentos); `metaId` nas transações |
| 14/11/2026 | Grupo G18 | 0.6.0 | Coleção `pendingregistrations` (cadastro pendente de confirmação do e-mail, com TTL) |
| 12/11/2026 | Grupo G18 | 0.5.0 | Coleção `connected_accounts` (conexão Pluggy); `externalId`, `origem` e `contaConectadaId` nas transações importadas |
| 09/11/2026 | Grupo G18 | 0.4.0 | Coleção `alerts` (alertas do Mentor IA) |
| 28/10/2026 | Grupo G18 | 0.3.0 | Coleções `users` (usuários, MFA, plano e preferências) e `chatmessages` (chat do Mentor IA) |
| 13/10/2026 | Grupo G18 | 0.2.0 | Coleção `transactions` (transações) |
| 07/10/2026 | Grupo G18 | 0.1.0 | Versão inicial: arquitetura definida e conexão com o MongoDB Atlas |

## 2. Entidades e atributos conceituais

A seguir estão as entidades que o FinanceAI guarda no MongoDB (acessado só pelo Backend), seus atributos, tipos conceituais, regras e exemplos aceitos e não aceitos. Tudo o que pertence a uma pessoa carrega o `userId` (id do usuário dono), e o Backend sempre filtra por ele: um usuário nunca enxerga dados de outro.

Convenções: **Id** é o identificador gerado pelo banco; **Dinheiro** é número em reais com duas casas; **Data/hora** é instante em UTC. Toda coleção (exceto as indicadas) tem também `createdAt` e `updatedAt`, preenchidos pelo banco.

Fora do banco: a lixeira do "Desfazer" (exclusão de conta, cartão e lançamentos) fica **só na memória do Backend**, por 30 segundos, e não é uma entidade persistida. O painel (Grupo 3) também não tem entidade própria: ele só lê e agrega as transações.

### 2.1. Usuário

Pessoa cadastrada no sistema. É a raiz de todos os dados: contas, lançamentos, cartões, metas e conversas pertencem a um usuário. Guarda as credenciais, o plano (Free ou Pro, que libera o Open Finance), a verificação em duas etapas (MFA) e as preferências de aparência.

#### Atributos de Usuário

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| nome | Texto | Sim | Simples | Maria Souza | "" | Nome de exibição; pode ser alterado no perfil. |
| email | E-mail | Sim | Simples, único | maria@exemplo.com | e-mail já cadastrado, "maria@" | Único no sistema. |
| cpf | CPF | Sim | Simples, único | 52998224725 | 11111111111, CPF de outro usuário | Só números; precisa ser um CPF válido. |
| senhaHash | Texto (hash) | Sim | Simples | `sal:hash` | senha em texto puro | A senha nunca é guardada; só o hash. Senha fraca é recusada antes de gerar o hash. |
| emailVerificado | Lógico | Sim | Simples | true | — | Começa `false`; vira `true` ao confirmar o e-mail. |
| emailVerificationTokenHash / emailVerificationExpiresAt | Texto (hash) / Data/hora | Não | Simples | — | — | Do link de confirmação; ficam ocultos nas consultas. |
| resetPasswordTokenHash / resetPasswordExpiresAt | Texto (hash) / Data/hora | Não | Simples | — | — | Do link de "esqueci a senha" (vale 15 minutos); ocultos nas consultas. |
| mfaEnabled | Lógico | Sim | Simples | false | — | Padrão `false`. |
| mfaSecret | Texto | Não | Simples | — | — | Segredo do autenticador; só existe com MFA ativado e fica oculto nas consultas. |
| mfaUltimoContador | Número inteiro | Não | Simples | — | — | Último código MFA usado, para não aceitar o mesmo código duas vezes. |
| plano | Elemento de lista enumerada | Sim | Simples | free, pro | gratis | Padrão `free`. |
| preferencias | Preferências de aparência | Sim | Composto (C) | ver 3.2 | — | Tema, estilo e ocultar valores. |

### 2.2. Cadastro pendente

Cadastro iniciado, mas ainda sem o e-mail confirmado. Só vira Usuário depois da confirmação. Existe para não criar contas com e-mails que o dono nunca confirmou.

#### Atributos de Cadastro pendente

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| nome, email, cpf, senhaHash | Texto | Sim | Simples | iguais aos do Usuário | vazios | Mesmas regras do Usuário. |
| tokenHash | Texto (hash) | Sim | Simples, único | — | — | Hash do token enviado no link de confirmação. |
| expiresAt | Data/hora | Sim | Simples | agora + 30 min | — | Passado esse instante o banco apaga o registro sozinho. |

### 2.3. Conta

Onde o dinheiro está: carteira, conta corrente, poupança. Toda pessoa tem ao menos uma conta, e todo lançamento pertence a uma. Pode ser **manual** (o saldo é calculado pelo Servidor Java a partir do saldo inicial e dos lançamentos; nunca é gravado) ou **Open Finance** (vem de uma conexão com a Pluggy, só no plano Pro, somente leitura: só o ícone e a cor mudam).

#### Atributos de Conta

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono da conta. |
| nome | Texto | Sim | Simples | Nubank, Conta principal | "", mais de 40 caracteres, nome já usado | De 1 a 40 caracteres; único por usuário sem diferenciar maiúsculas. |
| nomeChave | Texto | Sim | Simples | nubank | — | O nome em minúsculas; serve só para garantir a unicidade. |
| banco | Elemento de lista enumerada | Sim | Simples | nubank, itau, outro | banco-x | Um dos códigos da lista fixa (3.3). |
| tipo | Elemento de lista enumerada | Sim | Simples | manual, open_finance | poupanca | `open_finance` exige o plano Pro e uma conexão. |
| saldoInicial | Dinheiro | Sim | Simples | 0, 1500.50, -200 | "abc" | Só se define ao criar a conta; depois não muda. Padrão 0. |
| conectadaId | Id | Não | Simples | — | — | Referência à Conta conectada (só em conta Open Finance). Uma conexão tem uma única conta por usuário. |
| icone / cor | Aparência | Não | Composto (C) | ver 3.1 | — | Sem eles vale o logo do banco. |

### 2.4. Conta conectada (conexão Open Finance)

Conexão do usuário com um banco pela Pluggy. Guarda o resumo das contas da conexão na última sincronização e o estado dela. Desconectar apaga o registro e a Conta Open Finance vira manual.

#### Atributos de Conta conectada

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono da conexão. |
| pluggyItemId | Texto | Sim | Simples, único | UUID da Pluggy | item de outro usuário | Um item da Pluggy pertence a um só usuário. |
| connectorId | Número inteiro | Sim | Simples | 2 | — | 2 = Pluggy Bank (sandbox). |
| instituicao | Texto | Sim | Simples | Pluggy Bank | "" | Nome mostrado na tela. |
| status | Texto | Sim | Simples | UPDATED, UPDATING, LOGIN_ERROR, OUTDATED | — | Status do item na Pluggy. |
| contas | Conta da conexão (lista) | Sim | Multivalorado e Composto (MC) | ver 3.4 | — | Resumo das contas bancárias e de crédito da conexão. |
| ultimaSincronizacao | Data/hora | Não | Simples | — | — | Quando a importação rodou pela última vez. |
| contaDispensada | Lógico | Não | Simples | true | — | O usuário excluiu a conta criada para a conexão; evita recriá-la na próxima sincronização. |

### 2.5. Transação (lançamento)

Receita, despesa ou transferência de uma conta. É o dado central: alimenta o extrato, o painel, as metas, as faturas dos cartões e os alertas do Mentor. Pode ser **manual** (só em conta manual) ou **importada** da Pluggy (somente leitura, exceto `descricao`, `categoria`, `metaId` e `observacoes`). Uma transferência é um único registro entre duas contas manuais e não conta como receita nem despesa.

#### Atributos de Transação

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono do lançamento. |
| tipo | Elemento de lista enumerada | Sim | Simples | receita, despesa, transferencia | entrada | — |
| valor | Dinheiro | Sim | Simples | 10, 49.90 | 0, -5, "10" (texto) | Sempre positivo; o sinal vem do `tipo`. |
| categoria | Texto | Sim | Simples | Alimentacao, Transporte, Salario, Outros | "" | Texto livre; a lista sugerida está no contrato da API (2.3). Sem categoria, o Servidor Java sugere uma pela descrição. |
| data | Data/hora | Sim | Simples | 2026-11-20 | data inválida | Dia do lançamento. |
| descricao | Texto | Sim | Simples | Mercado | "" | — |
| observacoes | Texto | Não | Simples | Dividido com a Ana | mais de 300 caracteres | Até 300 caracteres. |
| formaPagamento | Elemento de lista enumerada | Sim | Simples | dinheiro, pix, debito, credito, boleto, outro | cheque | Padrão `outro`. |
| origem | Elemento de lista enumerada | Sim | Simples | manual, pluggy | — | Padrão `manual`. `pluggy` = importada, somente leitura. |
| contaId | Id | Sim* | Simples | — | conta de outro usuário | Conta do lançamento (a de origem, na transferência). *O Backend exige; o campo é opcional no banco só por causa de dados antigos, migrados na primeira leitura. |
| contaDestinoId | Id | Não | Simples | — | igual à origem | Só em transferência. |
| externalId | Texto | Não | Simples, único por usuário | id da Pluggy | repetido | Evita importar duas vezes a mesma transação. |
| contaConectadaId | Id | Não | Simples | — | — | Conexão de onde veio (só importadas). |
| metaId | Id | Não | Simples | — | meta de outro usuário | Meta ligada ao lançamento; excluir a meta só remove este vínculo. |
| cartaoId | Id | Não | Simples | — | cartão de outra conta | Obrigatório em compra no crédito; o cartão precisa ser da conta do lançamento. |
| parcelas | Número inteiro | Não | Simples | 1, 12, 24 | 0, 25 | De 1 a 24, em despesa no crédito. |
| parcelamentoId | Id | Não | Simples | — | — | Parcelamento criado pela compra parcelada. |

### 2.6. Cartão

Cartão de crédito do usuário, sempre vinculado a uma conta (os do Open Finance vêm das contas de crédito da conexão). A fatura fecha no `diaFechamento` e vence 7 dias depois. Cada usuário tem até 5 cartões. Excluir um cartão apaga também os lançamentos e parcelamentos dele (com "Desfazer" por 30 segundos).

#### Atributos de Cartão

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono do cartão. |
| nome | Texto | Sim | Simples | Nubank Roxinho | "", mais de 40 caracteres, nome já usado | De 1 a 40 caracteres. |
| nomeChave | Texto | Sim | Simples | nubank roxinho | — | Nome em minúsculas; único por usuário. |
| limite | Dinheiro | Sim | Simples | 5000 | 0, negativo | Maior que zero; padrão 5000 ao criar. |
| diaFechamento | Número inteiro | Sim | Simples | 3, 28 | 0, 29 | De 1 a 28; padrão 3. |
| contaId | Id | Sim* | Simples | — | conta de outro usuário | Conta do cartão. *O Backend exige ao criar; cartões antigos migram na primeira leitura. |
| pluggyAccountId | Texto | Não | Simples | — | — | Só nos cartões criados pela conexão Open Finance (não se excluem; desconectar os torna manuais). |
| icone / cor | Aparência | Não | Composto (C) | ver 3.1 | — | — |

### 2.7. Parcelamento do cartão

Compra parcelada (ou dívida) no cartão. Os parcelamentos criados por uma compra parcelada só saem excluindo a transação. As parcelas pagas avançam sozinhas, uma por mês.

#### Atributos de Parcelamento

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono. |
| cartaoId | Id | Não | Simples | — | cartão de outro usuário | Cartão da compra. |
| descricao | Texto | Sim | Simples | Notebook | "", mais de 100 caracteres | — |
| valorTotal | Dinheiro | Sim | Simples | 3600 | negativo | — |
| parcelas | Número inteiro | Sim | Simples | 12 | 0, mais de 120 | De 1 a 120 (compras parceladas pela tela vão até 24). |
| parcelasPagas | Número inteiro | Sim | Simples | 0, 3 | maior que `parcelas` | Padrão 0. |
| taxaJurosMensal | Número | Sim | Simples | 0, 1.99 | negativo, acima de 100 | Em % ao mês; padrão 0. Com juros, o Servidor Java usa a Tabela Price. |

### 2.8. Investimento

Ativo da carteira (recurso de apoio ao patrimônio; ainda sem tela própria).

#### Atributos de Investimento

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono. |
| nome | Texto | Sim | Simples | Tesouro Selic | "", mais de 100 caracteres | — |
| tipo | Elemento de lista enumerada | Sim | Simples | renda_fixa, renda_variavel, fundo, cripto, outro | acao | Padrão `outro`. |
| valorInvestido | Dinheiro | Sim | Simples | 1000 | negativo | — |
| taxaMensal | Número | Sim | Simples | 0.8 | — | Em % ao mês; padrão 0. Base da rentabilidade simulada. |
| dataAplicacao | Data/hora | Sim | Simples | 2026-01-10 | — | — |

### 2.9. Meta

Objetivo financeiro do usuário (reserva de emergência, viagem). O progresso soma `valorInicial` e os lançamentos ligados à meta (`metaId` na Transação).

#### Atributos de Meta

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono. |
| titulo | Texto | Sim | Simples | Viagem | "", mais de 100 caracteres | — |
| valorObjetivo | Dinheiro | Sim | Simples | 10000 | negativo | — |
| valorInicial | Dinheiro | Sim | Simples | 0, 500 | negativo | Padrão 0. |
| prazo | Data/hora | Não | Simples | 2027-06-30 | data no passado (ao criar ou alterar o prazo) | Sem prazo não há aporte mensal nem meta "vencida". |
| icone / cor | Aparência | Não | Composto (C) | ver 3.1 | — | — |

### 2.10. Mensagem do chat (Mentor IA)

Cada fala da conversa entre o usuário e o Mentor financeiro, mantida para o histórico.

#### Atributos de Mensagem do chat

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono da conversa. |
| autor | Elemento de lista enumerada | Sim | Simples | usuario, ia | bot | — |
| texto | Texto | Sim | Simples | Quanto gastei com lazer? | "" | — |
| proativa | Lógico | Não | Simples | true | — | Mensagem que o Mentor mandou sozinho, explicando alertas. Padrão `false`. |

### 2.11. Alerta

Aviso gerado por regras sobre os lançamentos (gasto fora do padrão, fatura próxima, dinheiro parado) e depois explicado pelo Mentor.

#### Atributos de Alerta

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| userId | Id | Sim | Simples | — | — | Dono. |
| tipo | Elemento de lista enumerada | Sim | Simples | gasto_fora_do_padrao, fatura_proxima, dinheiro_parado | outro | — |
| chave | Texto | Sim | Simples, único por usuário | fatura_proxima:2026-11 | chave repetida | Evita gerar o mesmo alerta duas vezes. |
| titulo, mensagem | Texto | Sim | Simples | — | "" | O que aparece para o usuário. |
| dados | Mapa texto/número | Sim | Composto (C) | `{ "categoria": "Lazer", "valor": 350 }` | — | Números e textos que embasam o alerta. Padrão vazio. |
| lido | Lógico | Sim | Simples | false | — | Padrão `false`. |
| explicadoEm | Data/hora | Não | Simples | — | — | Quando o Mentor já explicou o alerta no chat. |

### 2.12. Chamado de suporte

Problema reportado pelo usuário na tela de suporte.

#### Atributos de Chamado de suporte

| Atributo / Dado | Tipo conceitual | Obrigatório | Característica | Ex. aceitos | Ex. não aceitos | Comentários |
|:---|:---:|:---:|:---:|:---|:---|:---|
| usuarioId | Id | Sim | Simples | — | — | Quem reportou (referência ao Usuário). |
| assunto | Texto | Sim | Simples | Erro ao importar | "", mais de 100 caracteres | — |
| categoria | Elemento de lista enumerada | Sim | Simples | erro-tecnico, conta-acesso, plano, outros | duvida | — |
| descricao | Texto | Sim | Simples | Ao conectar o banco aparece um erro | menos de 10 caracteres | Mínimo de 10 caracteres. |
| status | Elemento de lista enumerada | Sim | Simples | aberto, em_andamento, resolvido | fechado | Padrão `aberto`. |

## 3. Tipos especiais, compostos ou específicos

| Padrões de atributos especiais |
|----|
|(C) =  Composto (Tipo estruturado, composto de partes que juntas formam o atributo em si)|
|(M) =  Multivalorado (vários valores)|
|(MC) =  Multivalorado e Composto (lista / array etc de um tipo composto)|

### 3.1. Aparência (ícone e cor)

Par opcional usado por contas, cartões e metas. Sem ele, vale o logo do banco. Em edição, `null` remove o valor.

| Atributo / Dado | Tipo | Obrigatório | Comentários |
| :---: | :--- | :---: | :--- |
| icone | Elemento de lista enumerada | Não | carteira, banco, cofrinho, cartao, cedulas, casa, mala, carro, escola, coracao, grafico, estrela. |
| cor | Elemento de lista enumerada | Não | azul, roxo, rosa, laranja, ambar, turquesa, verde, vermelho, cinza. |

### 3.2. Preferências de aparência (do Usuário)

| Atributo / Dado | Tipo | Obrigatório | Comentários |
| :---: | :--- | :---: | :--- |
| tema | Elemento de lista enumerada | Sim | `claro` (padrão) ou `escuro`. |
| estilo | Elemento de lista enumerada | Sim | `sombras` (padrão) ou `bordas`. |
| ocultarValores | Lógico | Sim | Esconde os valores em dinheiro nas telas. Padrão `false`. |

### 3.3. Banco (lista fixa)

Lista usada no campo `banco` da Conta: `bb` (Banco do Brasil), `bradesco`, `c6` (C6 Bank), `caixa`, `inter`, `itau` (Itaú), `nubank`, `santander`, `btg` (BTG Pactual) e `outro`.

### 3.4. Conta da conexão (da Conta conectada)

Cada item da lista `contas` de uma Conta conectada (MC).

| Atributo / Dado | Tipo conceitual | Obrigatório | Comentários |
| :---: | :--- | :---: | :--- |
| pluggyAccountId | Texto | Sim | Id da conta na Pluggy. |
| tipo | Texto | Sim | `BANK` (conta bancária) ou `CREDIT` (cartão de crédito). |
| nome | Texto | Sim | Nome da conta na instituição. |
| saldo | Dinheiro | Não | Saldo na última sincronização. |
| moeda | Texto | Não | Ex.: BRL. |
| limite | Dinheiro | Não | Só em `CREDIT`; origem do limite do cartão criado. |
| diaFechamento | Número inteiro | Não | Só em `CREDIT`; origem do dia de fechamento do cartão criado. |

## 4. Desdobramento físico ou tecnológico

O projeto usa **MongoDB Atlas**, acessado só pelo Backend (Mongoose). As referências entre coleções são feitas por id guardado como texto (`userId`, `contaId`, `cartaoId`, `metaId`), sem `$lookup` obrigatório.

### 4.1. Desdobramento para banco orientado a documentos

| Entidade conceitual | Coleção | Estratégia |
| :--- | :--- | :--- |
| Usuário | `users` | `preferencias` embutido (1 para 1, sempre lido junto). |
| Cadastro pendente | `pendingregistrations` | Documento isolado, apagado pelo banco após `expiresAt` (índice TTL). |
| Conta | `accounts` | Referencia a conexão por `conectadaId`; saldo **não** é gravado (calculado). |
| Conta conectada | `connected_accounts` | `contas` embutido (lista pequena, sempre lida com a conexão). |
| Transação | `transactions` | Referencia conta, cartão e meta por id; transferência é um só documento com `contaId` e `contaDestinoId`. |
| Cartão | `cards` | Referencia a conta por `contaId`. |
| Parcelamento do cartão | `card_installments` | Referencia o cartão por `cartaoId`. |
| Investimento | `investments` | Documento isolado por usuário. |
| Meta | `goals` | O progresso é calculado a partir das transações ligadas por `metaId` (não é gravado). |
| Mensagem do chat | `chatmessages` | Uma mensagem por documento (histórico paginado por data). |
| Alerta | `alerts` | `dados` embutido (mapa pequeno, lido com o alerta). |
| Chamado de suporte | `suportes` | Referencia o usuário por `usuarioId` (ObjectId). |

Exemplo de documento (`transactions`, compra parcelada no crédito):

```json
{
  "_id": "6740a1f2c3d4e5f6a7b8c9d0",
  "userId": "673f0000aaaa1111bbbb2222",
  "tipo": "despesa",
  "valor": 300,
  "categoria": "Lazer",
  "data": "2026-11-20T00:00:00.000Z",
  "descricao": "Show",
  "formaPagamento": "credito",
  "origem": "manual",
  "contaId": "6740a1f2c3d4e5f6a7b8c001",
  "cartaoId": "6740a1f2c3d4e5f6a7b8c101",
  "parcelas": 3,
  "parcelamentoId": "6740a1f2c3d4e5f6a7b8c201",
  "createdAt": "2026-11-20T18:02:11.000Z",
  "updatedAt": "2026-11-20T18:02:11.000Z"
}
```

Exemplo de documento (`connected_accounts`, com a lista embutida):

```json
{
  "userId": "673f0000aaaa1111bbbb2222",
  "pluggyItemId": "b2c1…-uuid",
  "connectorId": 2,
  "instituicao": "Pluggy Bank",
  "status": "UPDATED",
  "contas": [
    { "pluggyAccountId": "a1…", "tipo": "BANK", "nome": "Conta Corrente", "saldo": 1520.4, "moeda": "BRL" },
    { "pluggyAccountId": "c3…", "tipo": "CREDIT", "nome": "Cartão Black", "limite": 8000, "diaFechamento": 5 }
  ],
  "ultimaSincronizacao": "2026-11-21T12:00:00.000Z"
}
```

Justificativa:

- **Embutido:** `preferencias`, `contas` (da conexão) e `dados` (do alerta) são pequenos, não crescem sem limite e nunca são consultados sozinhos; embutir evita uma segunda leitura.
- **Referenciado:** contas, cartões, transações e metas são consultados e alterados de forma independente (extrato com filtros, fatura de um cartão, progresso de uma meta) e crescem com o tempo; por isso cada um tem a sua coleção e a ligação é por id.
- **Valores calculados e não gravados:** saldo da conta, fatura do cartão e progresso da meta saem dos lançamentos (e do Servidor Java), para nunca ficarem inconsistentes com eles.
- **Exclusão em cascata feita pelo Backend** (o MongoDB não tem chave estrangeira): excluir um cartão apaga os lançamentos e parcelamentos dele; excluir uma conta apaga os cartões e lançamentos dela (inclusive transferências). O "Desfazer" guarda os documentos na memória por 30 segundos.

### 4.2. Desdobramento para banco relacional

Comparação com um banco relacional, caso o projeto migrasse. Mostram-se as tabelas em que a modelagem **muda**; as demais entidades viram uma tabela por coleção, com os mesmos campos e `id_usuario` como FK para `usuario`.

### Tabela `USUARIO`

| Campo | Tipo físico | Obrigatório | Chave | Observação |
| :--- | :---: | :---: | :---: | :--- |
| id | integer | Sim | PK | Identificador único. |
| nome | varchar(100) | Sim |  | — |
| email | varchar(150) | Sim | UQ | Único. |
| cpf | char(11) | Sim | UQ | Só números. |
| senha_hash | varchar(255) | Sim |  | Hash da senha. |
| email_verificado | boolean | Sim |  | Padrão falso. |
| mfa_ativo | boolean | Sim |  | Padrão falso. |
| mfa_segredo | varchar(100) | Não |  | Só com MFA ativo. |
| plano | varchar(4) | Sim |  | `free` ou `pro`. |
| pref_tema | varchar(6) | Sim |  | Do tipo composto Preferências (colunas na própria tabela). |
| pref_estilo | varchar(8) | Sim |  | — |
| pref_ocultar_valores | boolean | Sim |  | — |

### Tabela `CONTA_DA_CONEXAO`

| Campo | Tipo físico | Obrigatório | Chave | Observação |
| :--- | :---: | :---: | :---: | :--- |
| id | integer | Sim | PK | Identificador único. |
| id_conta_conectada | integer | Sim | FK | Para `CONTA_CONECTADA`. |
| pluggy_account_id | varchar(60) | Sim |  | Id na Pluggy. |
| tipo | varchar(6) | Sim |  | `BANK` ou `CREDIT`. |
| nome | varchar(100) | Sim |  | — |
| saldo | numeric(14,2) | Não |  | — |
| limite | numeric(14,2) | Não |  | Só em `CREDIT`. |
| dia_fechamento | smallint | Não |  | Só em `CREDIT`. |

### Tabela `TRANSACAO`

| Campo | Tipo físico | Obrigatório | Chave | Observação |
| :--- | :---: | :---: | :---: | :--- |
| id | integer | Sim | PK | Identificador único. |
| id_usuario | integer | Sim | FK | Para `USUARIO`. |
| id_conta | integer | Sim | FK | Conta (origem, na transferência). |
| id_conta_destino | integer | Não | FK | Só em transferência. |
| id_cartao | integer | Não | FK | Obrigatório no crédito. |
| id_meta | integer | Não | FK | Meta ligada. |
| tipo | varchar(13) | Sim |  | receita, despesa ou transferencia. |
| valor | numeric(14,2) | Sim |  | Maior que zero. |
| data | date | Sim |  | — |
| descricao | varchar(200) | Sim |  | — |
| categoria | varchar(50) | Sim |  | — |
| forma_pagamento | varchar(10) | Sim |  | — |
| origem | varchar(6) | Sim |  | manual ou pluggy. |
| external_id | varchar(80) | Não | UQ (com id_usuario) | Evita importar duas vezes. |
| parcelas | smallint | Não |  | De 1 a 24. |

Justificativa:

- A lista `contas` da conexão (MC) vira a tabela própria `CONTA_DA_CONEXAO`: é uma relação 1 para N e normalizar garante integridade e permite consultar as contas de crédito sozinhas.
- As Preferências (C) viram colunas do próprio `USUARIO`, porque são sempre lidas com ele e têm cardinalidade 1 para 1.
- As referências por id de texto viram chaves estrangeiras reais; a cascata de exclusão que hoje o Backend faz poderia ser `ON DELETE CASCADE`, mas o "Desfazer" continuaria precisando de uma lixeira.

## 5. Consultas, índices e observações de arquitetura

| Consulta esperada | Campos envolvidos | Índices (MongoDB) | Observações |
| :--- | :--- | :--- | :--- |
| Login por e-mail ou CPF | `users.email`, `users.cpf` | únicos em `email` e `cpf` | Evita cadastro duplicado. |
| Confirmar o cadastro pelo link | `pendingregistrations.tokenHash` | único em `tokenHash` | O TTL em `expiresAt` apaga os vencidos. |
| Contas do usuário | `accounts.userId` | `userId` | Cada conta volta com o saldo calculado pelo Servidor Java. |
| Nome de conta/cartão único | `userId`, `nomeChave` | único (`userId`, `nomeChave`) em `accounts` e `cards` | Sem diferenciar maiúsculas. |
| Uma conta por conexão | `accounts.userId`, `conectadaId` | único parcial (`userId`, `conectadaId`) quando texto | — |
| Extrato por período | `transactions.userId`, `data` | (`userId`, `data` desc) | Consulta mais frequente, com filtros e paginação. |
| Lançamentos de uma conta (saldo, exclusão) | `userId`, `contaId` | (`userId`, `contaId`) | Transferências também por (`userId`, `contaDestinoId`), esparso. |
| Fatura e lançamentos de um cartão | `userId`, `cartaoId` | (`userId`, `cartaoId`) | A fatura soma o período do ciclo do cartão. |
| Progresso de uma meta | `userId`, `metaId` | (`userId`, `metaId`) | — |
| Importar sem duplicar (Pluggy) | `userId`, `externalId` | único parcial (`userId`, `externalId`) quando texto | — |
| Transações de uma conexão | `contaConectadaId` | `contaConectadaId` | Ao sincronizar ou desconectar. |
| Conexão por item | `pluggyItemId` | único | Um item é de um só usuário. |
| Metas por prazo | `goals.userId`, `prazo` | (`userId`, `prazo`) | Prazo mais próximo primeiro. |
| Histórico do chat | `chatmessages.userId`, `createdAt` | (`userId`, `createdAt` desc) | Mais recentes primeiro. |
| Alertas não lidos | `alerts.userId`, `lido`, `createdAt` | (`userId`, `lido`, `createdAt` desc) | Mais o único (`userId`, `chave`) para não repetir alerta. |
| Chamados do usuário | `suportes.usuarioId` | `usuarioId` | — |
| Painel (resumo, por categoria, comparação) | `transactions` | os de `transactions` | Sem coleção própria; o Servidor Java faz as contas. |

Observações de arquitetura:

- O Backend é o único que acessa o banco; o Servidor Java só recebe dados e devolve cálculos (saldo das contas, categoria, fatura, rentabilidade).
- Toda consulta filtra por `userId`; recurso de outro usuário responde como "não encontrado".
- Dados criados antes de contas e cartões (lançamentos sem `contaId`, compras no crédito sem cartão) são migrados na primeira leitura: nasce a "Conta principal" (banco "Outro", saldo inicial 0) e as compras ligam-se ao cartão mais antigo da conta.
