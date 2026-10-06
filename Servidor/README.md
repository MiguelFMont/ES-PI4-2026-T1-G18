# FinanceAI — Servidor (Java)

Servidor de sockets do FinanceAI. É a adaptação do **Fazedor de Continhas** do professor (`Servidor.java`, `AceitadoraDeConexao`, `SupervisoraDeConexao`, `Parceiro`, `Comunicado`) para o FinanceAI: a estrutura de threads é a mesma, mas a conversa com o cliente é em **JSON** (o cliente é o Backend Node, que não lê `ObjectOutputStream`) e o despacho é feito por um registro de handlers por grupo.

```
Frontend --WebSocket--> Backend --socket TCP (JSON)--> Servidor Java
```

O Servidor nunca fala com o Frontend, só com o Backend. Cada usuário conectado ao Backend tem uma conexão própria com o Servidor, e portanto uma `Supervisora` própria, como cada `Cliente` do professor.

## Comparação com o material do professor

| Professor | Aqui |
|---|---|
| `Servidor.java` (`main`, comando `desativar`) | `Main.java`, igual |
| `AceitadoraDeConexao` | `Aceitadora`, igual (recebe também o `HandlerRegistry`) |
| `SupervisoraDeConexao` com `if/else instanceof` | `Supervisora` busca o handler pelo `tipo` no `HandlerRegistry` |
| `Parceiro` com `ObjectInputStream`/`ObjectOutputStream` | `Parceiro` com linhas JSON; mesmos `receba`/`envie`/`espie`/`adeus` e `Semaphore` |
| `Comunicado` e subclasses (`PedidoDeOperacao`...) | `Comunicado` é o envelope `{ tipo, dados }`; `PedidoXxx`/`RespostaXxx` são POJOs de `dados` |
| `PedidoParaSair`, `ComunicadoDeDesligamento` | Mesmos, como `tipo` do envelope |
| Estado por conexão (`double valor`) | Não há: o estado fica no MongoDB, gerido pelo Backend |
| `Teclado` | Igual, copiada do material |

## O Servidor não acessa o banco

**Decisão:** o Servidor Java não se conecta ao MongoDB e não tem driver de banco no `pom.xml`. Só o Backend acessa o banco. Quando um cálculo do Servidor depende de dados do usuário, o Backend busca esses dados e os envia **dentro do pedido**. Exemplos:

- `PedidoValidarMFA` leva o segredo do MFA do usuário.
- `PedidoMontarContextoIA` leva os totais e as transações recentes.
- `PedidoValidarSenha` leva o hash guardado.
- `PedidoRentabilidadeSimulada` leva a lista de ativos.

Por isso os handlers do Servidor são funções puras: pedido entra, resposta sai, sem leitura nem escrita de dados. Tudo o que precisa ser persistido (usuários, transações, metas, histórico) é gravado pelo Backend a partir das respostas do Servidor. Ao criar ou alterar um `PedidoXxx`, inclua nele todos os dados de que o handler precisa.

## Protocolo

- Uma mensagem por linha, UTF-8, no formato `{"tipo":"...","dados":{...}}`.
- **Cada pedido recebe exatamente uma resposta, na mesma ordem.** O Backend casa as respostas por ordem de chegada (não há ID).
- Erro (handler falhou ou `tipo` desconhecido): a resposta é `{"tipo":"Erro","dados":{"message":"..."}}`.
- `PedidoParaSair` (Backend → Servidor) encerra a conexão; `ComunicadoDeDesligamento` (Servidor → Backend) avisa que o servidor vai desligar, ao digitar `desativar` no console.

## Mensagens por grupo

| Grupo | Pedido → Resposta | Handler |
|---|---|---|
| 1 — Autenticação & Conta | `PedidoHashSenha` → `RespostaHashSenha`; `PedidoValidarSenha` → `RespostaValidarSenha`; `PedidoValidarMFA` → `RespostaValidarMFA` | `AuthHandler` |
| 2 — Transações | `PedidoCategorizarTransacao` → `RespostaCategorizarTransacao` | `TransactionsHandler` |
| 3 — Painel & Análise | `PedidoCalcularIndicadores` → `RespostaCalcularIndicadores` | `DashboardHandler` |
| 4 — Mentor Financeiro (IA) | `PedidoMontarContextoIA` → `RespostaMontarContextoIA`; `PedidoFiltrarResposta` → `RespostaFiltrarResposta` | `MentorHandler` |
| 5 — Metas & Investimentos | `PedidoProgressoMeta` → `RespostaProgressoMeta`; `PedidoRentabilidadeSimulada` → `RespostaRentabilidadeSimulada` | `GoalsHandler`, `InvestmentsHandler` |

Cada grupo mexe só na própria pasta e adiciona **uma linha** em `HandlerRegistry.criarPadrao()`.

## `exemplo/`: documentação de cada arquivo

`src/main/java/com/financeai/` tem as pastas de cada pacote, sem nenhum `.java` ainda. Em cada pasta há uma subpasta `exemplo/` com um `.md` para cada arquivo `.java` planejado, explicando o que ele deve ter e trazendo um exemplo de implementação. Ao implementar, crie o `.java` no pacote correspondente; o `.md` fica como referência.

```
src/main/java/com/financeai/
  Main.java                  (exemplo/Main.md)
  core/                      Comunicado, Parceiro, Aceitadora, Supervisora, Handler, HandlerRegistry, Teclado
  auth/                      AuthHandler + PedidoHashSenha, PedidoValidarSenha, PedidoValidarMFA e respostas
  transactions/              TransactionsHandler + PedidoCategorizarTransacao e resposta
  dashboard/                 DashboardHandler + PedidoCalcularIndicadores e resposta
  mentoria/                  MentorHandler + PedidoMontarContextoIA, PedidoFiltrarResposta e respostas
  goals/                     GoalsHandler + PedidoProgressoMeta e resposta
  investments/               InvestmentsHandler + PedidoRentabilidadeSimulada e resposta
```

## Estado atual (Sprint 0)

Já implementados em `src/main/java/com/financeai/`: o `Main` e o `core/` (`Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`, `Handler`, `HandlerRegistry`, `Teclado`), mais o `EcoHandler`, um handler de teste: `PedidoEco` devolve `RespostaEco` com os mesmos `dados`. Os pacotes dos grupos (`auth`, `transactions`, `dashboard`, `mentoria`, `goals`, `investments`) ainda têm só os `.md` de exemplo; cada grupo adiciona o seu handler com uma linha em `HandlerRegistry.criarPadrao()`.

Verificado com um cliente de teste: eco, tipo desconhecido (resposta `Erro`), respostas na ordem, conexões independentes, `PedidoParaSair` e o comando `desativar` (que envia `ComunicadoDeDesligamento` aos clientes).

## Build com Maven

O `pom.xml` define o Java 17 e a dependência do Gson, que o Maven baixa sozinho (para `~/.m2`); não é preciso guardar nenhum `.jar` no repositório. Tudo o que o Maven gera fica em `target/` (`.class` compilados, `.jar`), que está no `.gitignore` e pode ser apagado com `mvn clean`.

**Pré-requisitos:** JDK 17 ou superior e [Maven](https://maven.apache.org/download.cgi) instalado e no `PATH` (confira com `java -version` e `mvn -v`). Uma IDE com Maven embutido (IntelliJ, VS Code com extensão Java) também serve.

## Como rodar

O servidor deve ser iniciado **antes** do Backend.

```bash
mvn compile
mvn exec:java -Dexec.mainClass=com.financeai.Main
# porta diferente da padrão (3000):
mvn exec:java -Dexec.mainClass=com.financeai.Main -Dexec.args="3001"
```

Para desativar, digite `desativar` no console.

### Testar a conexão (Sprint 0)

Com o servidor no ar, abra uma conexão TCP na porta (por exemplo `telnet localhost 3000` ou `nc localhost 3000`) e envie uma linha:

```
{"tipo":"PedidoEco","dados":{"oi":1}}
```

A resposta esperada é `{"tipo":"RespostaEco","dados":{"oi":1}}`. Um `tipo` sem handler devolve `{"tipo":"Erro",...}` e `{"tipo":"PedidoParaSair","dados":{}}` encerra a conexão.

## Pontos em aberto (contratos do Sprint 0)

- **Resposta `Erro`:** o Backend precisa tratar `tipo: "Erro"` como falha daquele pedido, repassando a mensagem. Os `.md` do Backend foram alinhados a isso.
- **Biblioteca JSON:** os exemplos usam Gson (declarado no `pom.xml`). Se o professor preferir outra, só `Comunicado` muda.
- **Maven:** usado por enquanto. A issue da Sprint 0 descreve compilação manual com `javac` e o `.jar` no classpath; falta confirmar com o professor se o Maven é aceito.
