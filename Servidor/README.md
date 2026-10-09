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
| 1 — Autenticação & Conta | hash e conferência de senha (PBKDF2), geração do segredo TOTP, validação do código do MFA |
| 2 — Transações | categorização automática de uma transação |
| 3 — Painel & Análise | cálculo dos indicadores (saldo, economia, fluxo de caixa) |
| 4 — Mentor Financeiro (IA) | montar o contexto da IA e filtrar a resposta (nunca recomendar compra/venda de ativo) |
| 5 — Metas & Investimentos | progresso de uma meta e rentabilidade simulada |

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

Os campos de cada mensagem estão nos `.md` de `exemplo/` (um por `PedidoXxx`/`RespostaXxx`) e precisam ser **idênticos** aos que o Backend envia e espera.

| Grupo | Pedido → Resposta | Handler |
|---|---|---|
| 1 — Autenticação & Conta | `PedidoHashSenha` → `RespostaHashSenha`; `PedidoValidarSenha` → `RespostaValidarSenha`; `PedidoGerarSegredoMFA` → `RespostaGerarSegredoMFA`; `PedidoValidarMFA` → `RespostaValidarMFA` | `AuthHandler` |
| 2 — Transações | `PedidoCategorizarTransacao` → `RespostaCategorizarTransacao` | `TransactionsHandler` |
| 3 — Painel & Análise | `PedidoCalcularIndicadores` → `RespostaCalcularIndicadores` | `DashboardHandler` |
| 4 — Mentor Financeiro (IA) | `PedidoMontarContextoIA` → `RespostaMontarContextoIA`; `PedidoFiltrarResposta` → `RespostaFiltrarResposta` | `MentorHandler` |
| 5 — Metas & Investimentos | `PedidoProgressoMeta` → `RespostaProgressoMeta`; `PedidoRentabilidadeSimulada` → `RespostaRentabilidadeSimulada` | `GoalsHandler`, `InvestmentsHandler` |

Cada grupo mexe só na própria pasta e adiciona **uma linha** em `HandlerRegistry.criarPadrao()`. Se um grupo precisar de uma operação nova, cria o par `PedidoXxx`/`RespostaXxx` e o registra no seu handler, combinando os campos com quem implementa o lado do Backend.

## `exemplo/`: documentação de cada arquivo

`src/main/java/com/financeai/` tem as pastas de cada pacote. Em cada pasta há uma subpasta `exemplo/` com um `.md` para cada arquivo `.java` planejado, explicando o que ele deve ter e trazendo um exemplo de implementação. Ao implementar, crie o `.java` no pacote correspondente; o `.md` fica como referência (e pode ser apagado quando o projeto estiver andando). Os exemplos foram compilados juntos com o `core` e as operações foram testadas (hash e conferência de senha, TOTP com o vetor da RFC 6238, categorização, indicadores, progresso de meta, rentabilidade, contexto e filtro da IA).

```
src/main/java/com/financeai/
  Main.java                  (exemplo/Main.md)
  core/                      Comunicado, Parceiro, Aceitadora, Supervisora, Handler, HandlerRegistry,
                             ErroDeNegocio, EcoHandler, Teclado
  auth/                      AuthHandler + mensagens de senha e MFA
  transactions/              TransactionsHandler + mensagens de categorização
  dashboard/                 DashboardHandler + mensagens dos indicadores
  mentoria/                  MentorHandler + mensagens de contexto e filtro da IA
  goals/                     GoalsHandler + mensagens de progresso de meta
  investments/               InvestmentsHandler + mensagens de rentabilidade simulada
```

## Estado atual (Sprint 0)

Já implementados como código: o `Main` e o `core/` (`Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`, `Handler`, `HandlerRegistry`, `ErroDeNegocio`, `Teclado`), mais o `EcoHandler`, um handler de teste: `PedidoEco` devolve `RespostaEco` com os mesmos `dados`; com `{"falhar":"negocio"}` responde `Erro` `TESTE_NEGOCIO` e com `{"falhar":"interno"}` responde `Erro` `INTERNAL_ERROR`. Os handlers dos grupos ainda são `.md` de exemplo.

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

## Pontos em aberto

- **Biblioteca JSON:** os exemplos usam Gson. Se o professor preferir outra, só `Comunicado` muda.
- **MFA no login:** o Backend decide quando pedir o código; a validação em si (`PedidoValidarMFA`) é do Servidor. O fluxo completo (token temporário até validar o código) será definido por outro integrante do grupo de Autenticação.
- **Alertas do Mentor IA:** quem **gera** os alertas (tarefa periódica ou o próprio fluxo do chat) ainda não está definido; a lista e a gravação são do Backend.
- **Mudança de contrato:** qualquer alteração em um `PedidoXxx`/`RespostaXxx` precisa ser feita junto com o Backend (ver o `service` do módulo correspondente).
