# FinanceAI — Servidor (Java)

Servidor de sockets do FinanceAI. É a adaptação do **Fazedor de Continhas** do professor (`Servidor.java`, `AceitadoraDeConexao`, `SupervisoraDeConexao`, `Parceiro`, `Comunicado`) para o FinanceAI: a estrutura de threads é a mesma, mas a conversa com o cliente é em **JSON** (o cliente é o Backend Node, que não lê `ObjectOutputStream`) e o despacho é feito por um registro de handlers por grupo.

```
Frontend --HTTP (REST)--> Backend --socket TCP (JSON)--> Servidor Java --> MongoDB (Atlas)
                          (gateway)                      (dono dos dados e das regras)
```

O Servidor nunca fala com o Frontend, só com o Backend. O Backend abre uma conexão por chamada, como um `Cliente` do professor, e cada conexão tem a sua `Supervisora`.

## O Servidor é o dono dos dados

**Decisão:** o Servidor Java é o **único** componente que acessa o MongoDB. O Backend não tem banco: ele só valida as requisições HTTP, assina o JWT e repassa cada operação como um pedido ao Servidor, que aplica as regras de negócio e lê e grava no banco.

- Cada grupo tem no Servidor um `XxxHandler` (as regras, uma função por pedido) e um `XxxRepository` (o acesso ao MongoDB daquele grupo). O handler nunca usa o driver direto.
- O `userId` vem em todo pedido (o Backend o tira do JWT) e é usado em **toda** consulta, para um usuário nunca alcançar dados de outro. Por isso só o Backend deve conseguir alcançar a porta do Servidor.
- Dados sensíveis (hash de senha, segredo do MFA) **nunca saem do Servidor**: `Banco.paraMapa` remove esses campos das respostas.
- Uma única instância de `MongoClient` (em `Banco`) é compartilhada por todas as `Supervisora`s; o cliente do driver é thread-safe e mantém seu próprio pool de conexões.
- Se o Servidor ou o banco estiver fora do ar, as rotas do Backend respondem `503`.

## Comparação com o material do professor

| Professor | Aqui |
|---|---|
| `Servidor.java` (`main`, comando `desativar`) | `Main.java`, igual (e conecta no MongoDB antes de aceitar conexões) |
| `AceitadoraDeConexao` | `Aceitadora`, igual (recebe também o `HandlerRegistry`) |
| `SupervisoraDeConexao` com `if/else instanceof` | `Supervisora` busca o handler pelo `tipo` no `HandlerRegistry` |
| `Parceiro` com `ObjectInputStream`/`ObjectOutputStream` | `Parceiro` com linhas JSON; mesmos `receba`/`envie`/`espie`/`adeus` e `Semaphore` |
| `Comunicado` e subclasses (`PedidoDeOperacao`...) | `Comunicado` é o envelope `{ tipo, dados }`; `PedidoXxx`/`RespostaXxx` são POJOs de `dados` |
| `PedidoParaSair`, `ComunicadoDeDesligamento` | Mesmos, como `tipo` do envelope |
| Estado por conexão (`double valor`) | Não há: o estado fica no MongoDB, gerido pelos handlers. É uma adaptação consciente. Como o Backend abre uma conexão por chamada, um estado guardado na `Supervisora` duraria só um pedido; se o professor exigir estado por conexão, a alternativa é o Backend manter uma conexão aberta por usuário (como no `Cliente` original) |
| `Teclado` | Igual, copiada do material |
| Sem banco de dados | `Banco` (MongoDB) e um `Repository` por grupo |

## Protocolo

- Uma mensagem por linha, UTF-8, no formato `{"tipo":"...","dados":{...}}`.
- **Cada conexão traz um pedido e recebe uma resposta.** O Backend conecta, envia o pedido, lê a resposta, envia `PedidoParaSair` e fecha; por isso não há ID de correlação.
- **Erro:** quando uma regra falha, a resposta é `{"tipo":"Erro","dados":{"code":"EMAIL_IN_USE","message":"..."}}`. O `code` é um identificador estável; o Servidor **não envia status HTTP**, o Backend o deduz do `code` (tabela em `shared/errors/error-codes.ts`). Os handlers lançam `ErroDeNegocio` e a `Supervisora` faz a conversão. Qualquer outra exceção vira `INTERNAL_ERROR` genérico (o detalhe fica só no log do servidor), e um `tipo` sem handler vira `UNKNOWN_TYPE`.
- `PedidoParaSair` (Backend → Servidor) encerra a conexão; `ComunicadoDeDesligamento` (Servidor → Backend) avisa que o servidor vai desligar, ao digitar `desativar` no console.
- O status HTTP de cada `code` fica na tabela do Backend (`shared/errors/error-codes.ts`).
- O Servidor escuta só em `127.0.0.1` e fecha conexões que ficam 30 s sem mandar nada.

## Mensagens por grupo (contrato com o Backend)

Os campos de cada mensagem estão nos `.md` de `exemplo/` (um por `PedidoXxx`/`RespostaXxx`) e precisam ser **idênticos** aos que o Backend envia e espera.

| Grupo | Pedido → Resposta | Handler |
|---|---|---|
| 1 — Autenticação & Conta | `PedidoRegistrarUsuario` → `RespostaRegistrarUsuario`; `PedidoLogin` → `RespostaLogin`; `PedidoObterPerfil` → `RespostaObterPerfil`; `PedidoHabilitarMFA` → `RespostaHabilitarMFA`; `PedidoValidarMFA` → `RespostaValidarMFA` | `AuthHandler` |
| 2 — Transações | `PedidoListarTransacoes`, `PedidoCriarTransacao`, `PedidoAtualizarTransacao`, `PedidoRemoverTransacao`, `PedidoDuplicarTransacao`, `PedidoImportarTransacoes` (cada um com a sua `Resposta`) | `TransactionsHandler` |
| 3 — Painel & Análise | `PedidoResumoPainel`, `PedidoGastosPorCategoria`, `PedidoCompararPeriodos` | `DashboardHandler` |
| 4 — Mentor Financeiro (IA) | `PedidoMontarContextoIA`, `PedidoFiltrarResposta`, `PedidoSalvarTrocaChat`, `PedidoHistoricoChat`, `PedidoListarAlertas` | `MentorHandler` |
| 5 — Metas & Investimentos | `PedidoListarMetas`, `PedidoCriarMeta`, `PedidoAtualizarMeta`, `PedidoRemoverMeta`, `PedidoProgressoMeta`; `PedidoPainelInvestimentos`, `PedidoListarParcelamentos` | `GoalsHandler`, `InvestmentsHandler` |

Cada grupo mexe só na própria pasta e adiciona **uma linha** em `HandlerRegistry.criarPadrao()`.

## `exemplo/`: documentação de cada arquivo

`src/main/java/com/financeai/` tem as pastas de cada pacote. Em cada pasta há uma subpasta `exemplo/` com um `.md` para cada arquivo `.java` planejado, explicando o que ele deve ter e trazendo um exemplo de implementação. Ao implementar, crie o `.java` no pacote correspondente; o `.md` fica como referência. Os exemplos de handlers, repositórios e mensagens foram compilados juntos com o `core` para conferir que o código é válido.

```
src/main/java/com/financeai/
  Main.java                  (exemplo/Main.md)
  core/                      Comunicado, Parceiro, Aceitadora, Supervisora, Handler, HandlerRegistry,
                             ErroDeNegocio, Banco, Teclado
  auth/                      AuthHandler, AuthRepository + mensagens de usuário e MFA
  transactions/              TransactionsHandler, TransactionsRepository + mensagens de transações
  dashboard/                 DashboardHandler, DashboardRepository + mensagens do painel
  mentoria/                  MentorHandler, MentorRepository + mensagens do chat, filtro e alertas
  goals/                     GoalsHandler, GoalsRepository + mensagens de metas
  investments/               InvestmentsHandler, InvestmentsRepository + mensagens de investimentos
```

## Estado atual (Sprint 0)

Já implementados como código: o `Main` e o `core/` (`Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`, `Handler`, `HandlerRegistry`, `ErroDeNegocio`, `Teclado`), mais o `EcoHandler`, um handler de teste: `PedidoEco` devolve `RespostaEco` com os mesmos `dados`; com `{"falhar":"negocio"}` responde `Erro` `TESTE_NEGOCIO` e com `{"falhar":"interno"}` responde `Erro` `INTERNAL_ERROR`. Ainda falta implementar o `Banco` (conexão com o MongoDB) e os handlers e repositórios dos grupos, que hoje existem como `.md` de exemplo.

Verificado com clientes de teste: eco, tipo desconhecido, erro de negócio e erro interno, conexões independentes, `PedidoParaSair` e o comando `desativar`.

## Build com Maven

O `pom.xml` define o Java 17 e as dependências (Gson, para o JSON, e o driver síncrono do MongoDB), que o Maven baixa sozinho para `~/.m2`; não é preciso guardar nenhum `.jar` no repositório. Tudo o que o Maven gera fica em `target/`, que está no `.gitignore` e pode ser apagado com `mvn clean`.

**Pré-requisitos:** JDK 17 ou superior e [Maven](https://maven.apache.org/download.cgi) instalado e no `PATH` (confira com `java -version` e `mvn -v`). Uma IDE com Maven embutido (IntelliJ, VS Code com extensão Java) também serve.

## Banco de dados (MongoDB Atlas)

O banco é um cluster do **MongoDB Atlas**, compartilhado por todos os integrantes (todos enxergam os mesmos dados). Não é preciso instalar o MongoDB nem o Docker. Só o Servidor acessa o banco.

### Configuração (cada integrante)

1. **Acesso ao projeto no Atlas:** peça o convite a quem criou o cluster e aceite-o no e-mail.
2. **Usuário do banco** (Atlas → *Database Access*): use o usuário combinado pelo grupo, com permissão de leitura e escrita (`readWrite`) no banco `financeai`.
3. **Liberar o seu IP** (Atlas → *Network Access* → *Add IP Address* → *Add Current IP Address*). Sem isso a conexão é recusada. Se o seu IP mudar (outra rede, Wi-Fi da faculdade), adicione-o de novo.
4. **String de conexão** (Atlas → *Database* → *Connect* → *Drivers*): copie a URI `mongodb+srv://...` e troque `<usuario>` e `<senha>` pelos valores reais.
5. **Variável de ambiente:** o Servidor lê a URI da variável de ambiente `MONGO_URI` (e, opcionalmente, `MONGO_DB`, padrão `financeai`). O Java não carrega arquivo `.env` sozinho; o `.env.example` desta pasta só documenta os nomes. Defina as variáveis antes de subir o servidor:

```bash
# PowerShell
$env:MONGO_URI = "mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/?retryWrites=true&w=majority"

# Git Bash / Linux / macOS
export MONGO_URI="mongodb+srv://<usuario>:<senha>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
```

Em uma IDE, coloque `MONGO_URI` nas variáveis de ambiente da configuração de execução do `Main`. O banco e as coleções são criados pelo MongoDB na primeira gravação.

### Segredos: cuidado

- A `MONGO_URI` contém a senha do banco: ela fica **só no seu ambiente** (ou em um `.env` local, que está no `.gitignore`) e nunca deve ser commitada.
- Não cole a URI com senha em issues, PRs, chats nem prints. No repositório, só o `.env.example` com os `<placeholders>`.
- Se a senha vazar, troque-a no Atlas (*Database Access* → *Edit*) e avise o grupo. Se possível, use um usuário de banco por integrante, para dar para revogar um acesso sem afetar os demais.
- Em *Network Access*, evite `0.0.0.0/0` (qualquer IP); libere só os IPs do grupo.

### Problemas comuns

- **`Server selection timed out`:** o seu IP não está liberado em *Network Access*, ou a rede bloqueia a porta 27017 (comum em Wi-Fi de faculdade; tente outra rede ou o 4G). O `Main` mostra "Nao foi possivel conectar ao MongoDB" e encerra.
- **`Authentication failed`:** usuário ou senha incorretos. Caracteres especiais na senha (`@`, `:`, `/`, `#`) precisam ser codificados na URI (por exemplo `@` vira `%40`).
- **`Variavel de ambiente MONGO_URI ausente`:** a variável não foi definida no terminal (ou na configuração da IDE) em que o servidor foi iniciado.
- **Cluster gratuito pausado:** clusters do plano gratuito podem pausar por inatividade; retome-o no painel do Atlas.

## Como rodar

Com o `MONGO_URI` definido (depois que o `Banco` estiver implementado), inicie o servidor. O Backend responde `503` nas rotas que dependem dele enquanto ele não estiver no ar.

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

## Pontos em aberto

- **Biblioteca JSON:** os exemplos usam Gson. Se o professor preferir outra, só `Comunicado` muda.
- **MFA no login:** o `PedidoLogin` devolve `mfaEnabled`; quando o usuário tem MFA, quem exige o código antes de entregar o token final (Backend ou Servidor) fica a definir pelo grupo de Autenticação.
- **Alertas do Mentor IA:** o `MentorRepository` grava e lista os alertas, mas quem os **gera** (uma tarefa periódica no Servidor ou o próprio fluxo do chat) ainda não está definido.
- **Mudança de contrato:** qualquer alteração em um `PedidoXxx`/`RespostaXxx` precisa ser feita junto com o Backend (ver o `service` do módulo correspondente).
