# FinanceAI — Servidor (Java)

Servidor de sockets do FinanceAI. É a adaptação do **Fazedor de Continhas** do professor (`Servidor.java`, `AceitadoraDeConexao`, `SupervisoraDeConexao`, `Parceiro`, `Comunicado`) para o FinanceAI: a estrutura de threads é a mesma, mas a conversa com o cliente é em **JSON** (o cliente é o Backend Node, que não lê `ObjectOutputStream`) e o despacho é feito por um registro de handlers por grupo.

```
Frontend --HTTP (REST)--> Backend --socket TCP (JSON)--> Servidor Java
                          (CRUD, MongoDB, JWT)           (operações específicas)
```

O Servidor nunca fala com o Frontend, só com o Backend.

## O que o Servidor faz

O Servidor é um **executor de operações**, como o fazedor de continhas: o Backend manda os dados no pedido (os "operandos"), o Servidor calcula e devolve o resultado. Ele **não acessa banco de dados** e não guarda estado entre pedidos; quem lê e grava no MongoDB é o Backend.

| Grupo | Operações no Servidor |
|---|---|
| 1 — Autenticação & Conta | hash e conferência de senha (PBKDF2). Geração do segredo TOTP e validação do código do MFA estão planejadas (só `.md` em `auth/exemplo/`), sem uso hoje |
| 2 — Transações | categorização automática de uma transação |
| 3 — Painel & Análise | cálculo dos indicadores (saldo, economia, fluxo de caixa) e **comparação entre períodos** (variação % de receitas, despesas e saldo, tendência das despesas) |
| 4 — Mentor Financeiro (IA) | montar o contexto da IA e filtrar a resposta (nunca recomendar compra/venda de ativo) |
| 5 — Metas & Investimentos | progresso de uma meta, rentabilidade simulada com **juros compostos** e **cálculo de parcelamentos** (parcela, juros, saldo devedor pela Tabela Price) |

Tudo que é CRUD (cadastro, listagens, edição) fica no Backend.

## Comparação com o material do professor

| Professor | Aqui |
|---|---|
| `Servidor.java` (`main`, comando `desativar`) | `Main.java`, igual |
| `AceitadoraDeConexao` | `Aceitadora`, igual (recebe também o `HandlerRegistry`; escuta só em `127.0.0.1`) |
| `SupervisoraDeConexao` com `if/else instanceof` | `Supervisora` busca o handler pelo `tipo` no `HandlerRegistry` |
| `Parceiro` com `ObjectInputStream`/`ObjectOutputStream` | `Parceiro` com linhas JSON; mesmos `receba`/`envie`/`espie`/`adeus` e `Semaphore` |
| `Comunicado` e subclasses (`PedidoDeOperacao`...) | `Comunicado` é o envelope `{ tipo, dados }`; `PedidoXxx`/`RespostaXxx` são POJOs de `dados` |
| `PedidoParaSair`, `ComunicadoDeDesligamento` | Mesmos, como `tipo` do envelope |
| Estado por conexão (`double valor`) | Não há estado por conexão: cada operação é pura (dados de entrada → resultado). É uma adaptação consciente; os dados persistentes ficam no MongoDB, do Backend |
| Cliente com uma conexão aberta e uma thread para o comunicado de desligamento | O Backend mantém um **pool de conexões duradouras** (cada uma com a sua `Supervisora`) e cada conexão escuta o `ComunicadoDeDesligamento` |
| `Teclado` | Igual, copiada do material |

## Protocolo

- Uma mensagem por linha, UTF-8, no formato `{"tipo":"...","dados":{...}}`.
- **Conexões duradouras e simultâneas.** O Backend mantém várias conexões abertas (um pool, `JAVA_SERVER_POOL_SIZE`). Cada conexão atende **um pedido por vez** (envia o pedido, lê a resposta) e fica disponível para o próximo; pedidos simultâneos usam conexões diferentes, cada uma com a sua `Supervisora`. Por isso não há ID de correlação.
- **Erro:** quando uma regra falha, a resposta é `{"tipo":"Erro","dados":{"code":"VALIDATION","message":"..."}}`. O `code` é um identificador estável; o Servidor **não envia status HTTP**, o Backend o deduz do `code` (tabela em `shared/errors/error-codes.ts`). Os handlers lançam `ErroDeNegocio` e a `Supervisora` faz a conversão. Qualquer outra exceção vira `INTERNAL_ERROR` genérico (o detalhe fica só no log do servidor), e um `tipo` sem handler vira `UNKNOWN_TYPE`.
- `PedidoParaSair` (Backend → Servidor) encerra a conexão; `ComunicadoDeDesligamento` (Servidor → Backend) avisa que o servidor vai desligar, ao digitar `desativar` no console.
- O Servidor escuta só em `127.0.0.1` e fecha conexões que ficam 5 minutos sem mandar nada (o Backend reconecta sozinho).
- Como as operações são puras, o Backend pode repetir um pedido com segurança se a conexão cair no meio.

## Mensagens por grupo (contrato com o Backend)

Os campos de cada mensagem estão no `.java` dela (quando já implementada) ou no `.md` de `exemplo/` (um por `PedidoXxx`/`RespostaXxx`, enquanto for só planejada) e precisam ser **idênticos** aos que o Backend envia e espera.

| Grupo | Pedido → Resposta | Handler |
|---|---|---|
| 1 — Autenticação & Conta | `PedidoHashSenha` → `RespostaHashSenha`; `PedidoValidarSenha` → `RespostaValidarSenha`. Planejadas, ainda não implementadas: `PedidoGerarSegredoMFA` → `RespostaGerarSegredoMFA`; `PedidoValidarMFA` → `RespostaValidarMFA` | `AuthHandler` |
| 2 — Transações | `PedidoCategorizarTransacao` → `RespostaCategorizarTransacao` | `TransactionsHandler` |
| 3 — Painel & Análise | `PedidoCalcularIndicadores` → `RespostaCalcularIndicadores`; `PedidoCompararPeriodos` → `RespostaCompararPeriodos` | `DashboardHandler` |
| 4 — Mentor Financeiro (IA) | `PedidoMontarContextoIA` → `RespostaMontarContextoIA`; `PedidoFiltrarResposta` → `RespostaFiltrarResposta` | `MentorHandler` |
| 5 — Metas & Investimentos | `PedidoProgressoMeta` → `RespostaProgressoMeta`; `PedidoRentabilidadeSimulada` → `RespostaRentabilidadeSimulada`; `PedidoCalcularParcelamentos` → `RespostaCalcularParcelamentos` | `GoalsHandler`, `InvestmentsHandler` |

Cada grupo mexe só na própria pasta e adiciona **uma linha** em `HandlerRegistry.criarPadrao()`. Se um grupo precisar de uma operação nova, cria o par `PedidoXxx`/`RespostaXxx` e o registra no seu handler, combinando os campos com quem implementa o lado do Backend.

Quando uma mensagem já está implementada, o contrato vale pelo `.java` (o `.md` de `exemplo/` pode estar desatualizado). Por isso `core/` e `transactions/` já não têm pasta `exemplo/`: tudo o que havia nelas virou código.

### Grupo 2 — Transações (`transactions/`, implementado)

| Mensagem | `dados` |
|---|---|
| `PedidoCategorizarTransacao` | `{ "descricao": "UBER EATS *PEDIDO", "valor": 54.9 }`. A categoria sai só da `descricao`; o `valor` faz parte do contrato, mas hoje não influencia a decisão |
| `RespostaCategorizarTransacao` | `{ "categoria": "Alimentacao" }`: uma das categorias do contrato da API (`Alimentacao`, `Transporte`, `Moradia`, `Saude`, `Lazer`, `Educacao`, `Salario`, `Outros`) |

- **Como decide** (`TransactionsHandler`): a descrição é normalizada (minúsculas, sem acentos, só letras, sem palavras como `de`, `credito` e `pix`) e comparada **por palavra inteira** com grupos `{ categoria, palavras... }`. **A ordem dos grupos é a prioridade**: as exceções vêm primeiro (`uber eats` é comida, `mercado livre` não é supermercado). Sem palavra conhecida, `Outros`. A lista completa e os cuidados estão em [`docs/palavras-chave-categorias.md`](../docs/palavras-chave-categorias.md).
- `descricao` ausente ou em branco, ou `dados` fora do formato (um texto no lugar de um objeto), respondem `Erro` `VALIDATION`.
- **Quem chama é o Backend** (`transactionsService.sugerirCategoria`), no cadastro de uma transação sem `categoria`. Se o Servidor estiver fora do ar, o cadastro não falha: a transação é salva como `Outros`. Outros erros do Servidor (como `UNKNOWN_TYPE`, de um Servidor desatualizado) continuam sendo erro.
- No Frontend, a opção **Automática** da categoria é o que dispara esse pedido.

### Grupo 4 — Mentor IA (`mentoria/`, implementado)

A API de IA é chamada pelo Backend **entre** os dois pedidos: contexto → IA → filtro.

| Mensagem | `dados` |
|---|---|
| `PedidoMontarContextoIA` | `{ "diaDoMes": 28, "transacoes": [{ "tipo": "despesa", "valor": 1400, "categoria": "Moradia", "descricao": "Aluguel", "data": "2026-10-05T12:00:00.000Z" }, ...] }`: as transações do mês atual do usuário; `diaDoMes` de 1 a 31 (base da média diária) |
| `RespostaMontarContextoIA` | `{ "contexto": "Mês atual (até o dia 28): receitas R$ 4.500,00; despesas R$ 1.897,85; ..." }`: resumo em texto com totais, poupança, % por categoria, média diária e as 3 maiores despesas, já formatados em pt-BR |
| `PedidoFiltrarResposta` | `{ "resposta": "<texto que a IA devolveu>" }` |
| `RespostaFiltrarResposta` | `{ "respostaFiltrada": "<texto sem recomendação de ativo>" }` |

- **As contas são do Java** (`MentorHandler.montarContexto`), porque a IA erra aritmética. Até 8 categorias aparecem no resumo; as demais somam em "demais categorias". As descrições (texto livre do usuário) entram cortadas em 40 caracteres e numa linha só.
- **O filtro de assunto** (`FiltroDeEscopo`) roda antes: o prompt manda a IA responder só `FORA_DO_ESCOPO` quando o pedido não é de finanças pessoais, e uma resposta com esse marcador **ou com código** (bloco ``` ou linhas como `def soma(a, b):`, `function`, `return a + b`, `console.log(`) vira inteira a recusa `FiltroDeEscopo.AVISO`. O prompt sozinho não basta: o modelo pode aceitar escrever código mesmo assim.
- **O filtro** (`FiltroDeAtivos`) analisa frase a frase. Uma frase é removida quando tem **um ativo específico** (código da B3, como `PETR4` ou `MXRF11`, ou um nome de uma lista de criptomoedas e empresas) **e** linguagem de recomendação (compre, venda, aporte, invista, recomendo, mantenha...). Recusas explícitas ("não posso recomendar PETR4") passam; "não posso recomendar, mas compre ITUB4" não passa, porque cada trecho depois de "mas/porém/contudo" é julgado separado. Se alguma frase sai, o aviso `FiltroDeAtivos.AVISO` é acrescentado no fim; se quase nada sobra, a resposta vira só o aviso.
- `diaDoMes` fora de 1 a 31, `valor` negativo ou `tipo` diferente de `receita`/`despesa` respondem `Erro` `VALIDATION`.

### Grupo 5 — Metas (`goals/`) e Investimentos (`investments/`), implementados

Operações puras, como as dos outros grupos: tudo chega no pedido e nada é gravado. O CRUD, as coleções e a leitura das transações do usuário são do Backend; aqui ficam só as contas. Erro de regra: `Erro` `VALIDATION`.

| Mensagem | `dados` |
|---|---|
| `PedidoProgressoMeta` | `{ "valorAtual": 5000, "valorObjetivo": 10000, "prazo": "2027-05-14T00:00:00.000Z" }`: o prazo aceita o instante ISO ou só a data (`2027-05-14`). O prazo da meta é opcional no Backend: para meta sem prazo ele manda a data de hoje e ignora os campos que dependem dela (dias, meses e aporte). Opcional: `hoje`, o dia de referência (só os testes usam; sem ele vale o relógio do Servidor, em UTC) |
| `RespostaProgressoMeta` | `{ "percentual": 50, "falta": 5000, "concluida": false, "noPrazo": true, "diasRestantes": 181, "mesesRestantes": 7, "aporteMensalNecessario": 714.29 }` |
| `PedidoRentabilidadeSimulada` | `{ "meses": 1, "ativos": [{ "id": "a1", "nome": "CDB", "valor": 1000, "taxaMensal": 1, "meses": 12 }] }`: `valor` obrigatório (maior que zero), `taxaMensal` em % (padrão 0), `meses` por ativo (senão vale o do pedido, padrão 1). Os outros campos do ativo voltam iguais |
| `RespostaRentabilidadeSimulada` | `{ "ativos": [{ ..., "valorAtual": 1126.83, "rendimento": 126.83, "rentabilidade": 12.68, "percentualCarteira": 100 }], "totalInvestido": 1000, "patrimonio": 1126.83, "rendimento": 126.83, "rentabilidade": 12.68 }` |
| `PedidoCalcularParcelamentos` | `{ "parcelamentos": [{ "id": "p1", "valorTotal": 1000, "parcelas": 10, "parcelasPagas": 4, "taxaJurosMensal": 2 }] }` |
| `RespostaCalcularParcelamentos` | `{ "parcelamentos": [{ ..., "valorParcela": 111.33, "parcelasRestantes": 6, "saldoDevedor": 623.59, "jurosTotal": 113.27, "quitado": false }], "totalParcelasDoMes": 111.33, "totalSaldoDevedor": 623.59, "totalJuros": 113.27 }` |

- **Progresso** (`GoalsHandler`): percentual = acumulado ÷ objetivo, de 0 a 100, com 2 casas (um acumulado negativo conta como 0); `concluida` quando o acumulado alcança o objetivo; `noPrazo` quando concluída ou o prazo não é anterior a hoje; `mesesRestantes` = `ceil(dias ÷ 30)`, no mínimo 1; aporte mensal = falta ÷ meses. Objetivo zero ou negativo e prazo ausente ou inválido respondem `VALIDATION`.
- **Rentabilidade** (`InvestmentsHandler`): juros compostos, `valorAtual = valor × (1 + taxa/100)^meses`; o `percentualCarteira` de cada ativo é o valor atual dele sobre o patrimônio. Carteira vazia devolve zeros, sem erro.
- **Parcelamentos** (`InvestmentsHandler`): tabela Price, `parcela = total × i ÷ (1 − (1+i)^−n)` (sem juros, `total ÷ n`); `saldoDevedor` é o valor presente das parcelas que faltam; os totais só somam os parcelamentos ainda ativos. O `parcelasPagas` que chega no pedido já vem ajustado pelo Backend: uma parcela a mais a cada mês desde a compra.

## `exemplo/`: documentação de cada arquivo

`src/main/java/com/financeai/` tem as pastas de cada pacote. Em cada pasta há uma subpasta `exemplo/` com um `.md` para cada arquivo `.java` planejado, explicando o que ele deve ter e trazendo um exemplo de implementação. Ao implementar, crie o `.java` no pacote correspondente; o `.md` fica como referência (e pode ser apagado quando o projeto estiver andando). Os exemplos foram compilados juntos com o `core` e as operações foram testadas (hash e conferência de senha, TOTP com o vetor da RFC 6238, categorização, indicadores, comparação de períodos, progresso de meta, rentabilidade com juros compostos, parcelamentos, contexto e filtro da IA).

```
src/main/java/com/financeai/
  Main.java                  (exemplo/Main.md)
  core/                      Comunicado, Parceiro, Aceitadora, Supervisora, Handler, HandlerRegistry,
                             ErroDeNegocio, EcoHandler, Teclado
  auth/                      AuthHandler + mensagens de senha e MFA
  transactions/              TransactionsHandler + mensagens de categorização
  dashboard/                 DashboardHandler + mensagens de indicadores e comparação de períodos
  mentoria/                  MentorHandler + mensagens de contexto e filtro da IA
  goals/                     GoalsHandler + mensagens de progresso de meta
  investments/               InvestmentsHandler + mensagens de rentabilidade simulada e parcelamentos
```

## Estado atual

Implementados como código: o `Main` e o `core/` (`Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`, `Handler`, `HandlerRegistry`, `ErroDeNegocio`, `Teclado`), o `EcoHandler` (handler de teste: `PedidoEco` devolve `RespostaEco` com os mesmos `dados`; com `{"falhar":"negocio"}` responde `Erro` `TESTE_NEGOCIO` e com `{"falhar":"interno"}` responde `Erro` `INTERNAL_ERROR`) e os handlers dos cinco grupos: `AuthHandler` (hash e conferência de senha), `TransactionsHandler` (categorização), `DashboardHandler` (indicadores e comparação de períodos), `MentorHandler` (contexto e filtro do Mentor IA), `GoalsHandler` e `InvestmentsHandler` (metas, rentabilidade e parcelamentos). Só as mensagens de MFA do Grupo 1 continuam como `.md` de exemplo.

## Build com Maven

O `pom.xml` define o Java 17 e a única dependência (Gson, para o JSON), que o Maven baixa sozinho para `~/.m2`; não é preciso guardar nenhum `.jar` no repositório. Tudo o que o Maven gera fica em `target/`, que está no `.gitignore` e pode ser apagado com `mvn clean`.

**Pré-requisitos:** JDK 17 ou superior e [Maven](https://maven.apache.org/download.cgi) instalado e no `PATH` (confira com `java -version` e `mvn -v`). Uma IDE com Maven embutido (IntelliJ, VS Code com extensão Java) também serve.

## Como rodar

O Servidor não precisa de banco nem de variáveis de ambiente. O Backend responde `503` nas rotas que dependem dele enquanto ele não estiver no ar.

```bash
mvn compile
mvn exec:java -Dexec.mainClass=com.financeai.Main
# porta diferente da padrão (3000):
mvn exec:java -Dexec.mainClass=com.financeai.Main -Dexec.args="3001"
```

Para desativar, digite `desativar` no console. O MongoDB (Atlas) é configurado no Backend (ver `Backend/README.md`).

### Testar a conexão (Sprint 0)

Com o servidor no ar, abra uma conexão TCP na porta (por exemplo `telnet localhost 3000` ou `nc localhost 3000`) e envie uma linha:

```
{"tipo":"PedidoEco","dados":{"oi":1}}
```

A resposta esperada é `{"tipo":"RespostaEco","dados":{"oi":1}}`. Um `tipo` sem handler devolve `{"tipo":"Erro",...}` e `{"tipo":"PedidoParaSair","dados":{}}` encerra a conexão.

## Testes

Testes automatizados com JUnit 5 (dependência de teste no `pom.xml`, executada pelo `maven-surefire-plugin`), em `src/test/java/`, no mesmo pacote da classe testada. Não precisam do Servidor no ar nem de rede.

```bash
mvn test        # ou mvn -q test
```

São 174 testes no total. Cobertura do Grupo 1 (`auth/`) e do Grupo 3 (`dashboard/`):

- **`AuthHandlerTest`** (6 casos): hash no formato `sal:hash` e diferente da senha; a mesma senha gera hashes diferentes (sal); senha correta confere com o hash gerado por outro pedido; senha errada ou diferente só na caixa não confere; senha ausente e hash mal formado (sem `:` ou fora do Base64) respondem `VALIDATION`.
- **`DashboardHandlerTest`** (10 casos): saldo, economia e fluxo de caixa; sem receitas a economia é 0; despesas maiores que receitas dão saldo e economia negativos; comparação com um só período, variação em %, tendência de alta, queda e estável (limite de 5%), período anterior zerado sem divisão por zero; lista vazia ou ausente e valor que não é número respondem `VALIDATION`.

Cobertura do Grupo 2 e do `core/` (testes de Teste OO, intraclasse e interclasse):

- **`TransactionsHandlerTest`** (14 casos): particionamento por categorias de métodos (registro no `HandlerRegistry`, serviço pelo registry, `categoriaDe`, normalização) e por atributos (classes de equivalência da `descricao`: palavra-chave, sem palavra-chave, só números, só ruído, palavra dentro de outra, exceção antes da regra geral, ausente ou em branco; o `valor` não influencia). Registra como limitação que o plural ("farmacias") não casa.
- **`ComunicadoTest`** (9 casos, `core/`): estados do objeto (válido, sem dados, tipo ausente, vindo do JSON) e categorias de métodos (fábricas, conversão de e para JSON, leitura inválida).
- **`CategorizarTransacaoInterclasseTest`** (5 casos): abre uma conexão TCP de verdade com uma `Supervisora` e percorre `Supervisora` → `Parceiro` → `Comunicado` → `HandlerRegistry` → `TransactionsHandler`: cenário normal, descrição em branco (`VALIDATION`), tipo desconhecido (`UNKNOWN_TYPE`), `dados` fora do formato (`VALIDATION`) e conexão que continua aberta depois de um erro.

Cobertura do Grupo 4 (`mentoria/`):

- **`FiltroDeAtivosTest`**: remove frases que recomendam ativo (código da B3 como `PETR4`/`MXRF11` ou nomes como "bitcoin") e acrescenta o `AVISO`; deixa passar recusas explícitas ("Não posso recomendar PETR4"); "não posso recomendar, mas compre ITUB4" é removida; texto sem ativo volta igual; resposta vazia ou quase toda removida vira só o aviso; linhas e listas do markdown são preservadas. Também testa `recomendaAtivo` frase a frase.
- **`FiltroDeEscopoTest`**: o marcador `FORA_DO_ESCOPO` (puro, em negrito, entre colchetes) e respostas com código (Python, JavaScript, Java, C, imports) viram a recusa; respostas de finanças com listas, parênteses, "função da reserva", "Classe de ativos", "Importante:" e "print (captura da tela)" passam iguais.
- **`MentorHandlerTest`**: `PedidoMontarContextoIA` pelo `HandlerRegistry` (totais em pt-BR como `R$ 1.400,00`, percentuais por categoria, média diária, maiores despesas, "demais categorias", mês sem transações) e os erros `VALIDATION` (`diaDoMes` fora de 1 a 31, `tipo` inválido, valor negativo); `PedidoFiltrarResposta` usando os filtros de ativos e de assunto.

Cobertura do Grupo 5 (`goals/` e `investments/`): o resultado esperado de cada caso foi calculado por fora do código (os números não repetem a fórmula do handler).

- **`GoalsHandlerTest`**: progresso pela metade com dias, meses e aporte mensal; 2 casas decimais; meta atingida (100%, sem falta nem aporte); concluída conta como no prazo mesmo com o prazo vencido; prazo vencido sem concluir; prazo no próprio dia; os meses sobem depois de 30 dias; acumulado negativo conta como zero; objetivo zero ou negativo e prazo ausente ou inválido viram `VALIDATION`; sem `hoje` vale o relógio.
- **`InvestmentsHandlerTest`**: juros compostos por ativo com `meses` próprio e o percentual da carteira; `meses` do pedido e o padrão de 1 mês; taxa zero e negativa; carteira vazia ou ausente; ativo inválido (valor, taxa, meses, tipos); parcelamento pela tabela Price com saldo devedor e juros; sem juros; quitado fora dos totais; sem parcelamentos; parcelamento inválido.

O caminho Backend → Servidor (socket) é testado pelo teste de integração do Backend, com este Servidor no ar (ver "Testes" em `../Backend/README.md`). Ainda não há CI configurado.

## Pontos em aberto

- **Biblioteca JSON:** os exemplos usam Gson. Se o professor preferir outra, só `Comunicado` muda.
- **MFA no login:** o Backend decide quando pedir o código; a validação em si (`PedidoValidarMFA`) é do Servidor. O fluxo completo (token temporário até validar o código) será definido por outro integrante do grupo de Autenticação.
- **Alertas do Mentor IA:** quem **gera** os alertas (tarefa periódica ou o próprio fluxo do chat) ainda não está definido; a lista e a gravação são do Backend.
- **Mudança de contrato:** qualquer alteração em um `PedidoXxx`/`RespostaXxx` precisa ser feita junto com o Backend (ver o `service` do módulo correspondente).
