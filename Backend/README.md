# FinanceAI — Backend

Backend em **arquitetura limpa por feature**, seguindo a divisão de grupos e a arquitetura de componentes do README principal do repositório (`../README.md`).

## O que o Backend faz

O Backend é a **API REST (Node.js, TypeScript e Express)** do FinanceAI. Ele recebe as requisições HTTP do Frontend, valida e autentica, guarda e lê os dados no **MongoDB (Atlas)** e pede ao **Servidor Java** as operações específicas de cada feature (hash de senha, categorização, indicadores etc.).

1. **API HTTP para o Frontend** (`src/http/`): rotas sob `/v1/...` (`/v1/auth`, `/v1/transactions`...), JSON e autenticação por JWT no header `Authorization: Bearer <token>`. É o Backend que assina e verifica o JWT.
2. **Banco de dados** (`src/database/` e os `model`/`repository` de cada módulo): Mongoose sobre o cluster do MongoDB Atlas. Só o Backend acessa o banco.
3. **Cliente do Servidor Java** (`src/java-client/`): cada operação específica vira um pedido ao Servidor, por socket TCP com mensagens JSON em linhas. O Servidor segue o sistema cliente-servidor do "Fazedor de Continhas" ensinado em aula (`Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`), e a pasta `java-client/` é uma porta quase literal de `Comunicado.java`/`Parceiro.java`/`Cliente.java`, mantendo os nomes `envie`/`receba`/`espie`.

```
Frontend --HTTP (REST/JSON)--> Backend --socket TCP (JSON)--> Servidor Java
(navegador)                    (CRUD, MongoDB, JWT,            (operações específicas,
                                IA e Pluggy)                    sem banco)
```

O navegador não consegue abrir um socket TCP puro, por isso o Backend fica no meio: ele traduz HTTP em mensagens de socket para o Servidor Java.

### O que é do Backend e o que é do Servidor

| Backend | Servidor Java |
|---|---|
| Rotas HTTP, validação do corpo (`zod`), CORS, JWT | Hash e conferência de senha (PBKDF2), segredo e código TOTP do MFA |
| CRUD no MongoDB (usuários, transações, metas, chat...) | Categorização de transações |
| Orquestração: lê os dados, pede a operação ao Servidor e grava o resultado | Cálculo dos indicadores do painel e comparação entre períodos |
| Chamadas externas que precisam de internet e chave: API de IA generativa e Pluggy | Contexto e filtro de segurança do Mentor IA |
| Tradução dos erros do Servidor em status HTTP | Progresso de meta, rentabilidade com juros compostos e cálculo de parcelamentos |

O Servidor **não acessa o banco**: o Backend manda os dados no pedido e recebe o resultado. Isso deixa cada operação do Servidor pura (entrada → saída), fácil de testar e de repetir.

### Conexões duradouras com o Java (pool)

Como o `Cliente` do professor, o Backend **fica conectado** ao Servidor. Como atende várias requisições HTTP ao mesmo tempo, mantém um **pool** de conexões (`JAVA_SERVER_POOL_SIZE`, padrão 5), cada uma com a sua `Supervisora` no Servidor:

- cada conexão atende **um pedido por vez** e volta ao pool; pedidos simultâneos usam conexões diferentes (por isso não há ID de correlação);
- cada conexão escuta o `ComunicadoDeDesligamento` (aviso do Servidor ao digitar `desativar`): as chamadas em andamento falham com `503` e a conexão sai do pool;
- se a conexão cair (Servidor reiniciado), o pedido seguinte **reconecta sozinho**; um pedido interrompido é repetido uma vez;
- há um **timeout** por pedido (`JAVA_SERVER_TIMEOUT_MS`): se o Servidor não responder, a rota devolve `503`;
- ao encerrar o Backend, ele manda `PedidoParaSair` em cada conexão.

Se o Servidor Java estiver fora do ar, só as rotas que dependem dele respondem `503`; o resto (por exemplo, listar transações) continua funcionando.

### Erros vindos do Servidor

Quando uma operação falha, o Servidor responde `{"tipo":"Erro","dados":{"code":"VALIDATION","message":"..."}}`. O `java-client` consulta a tabela `code → status` (`shared/errors/error-codes.ts`) e cria um `AppError`; o `error-handler.middleware` devolve a resposta HTTP. O Servidor não conhece HTTP: ele diz *o que* aconteceu e o Backend decide o status. Um `code` fora da tabela vira `502 JAVA_SERVER_ERROR`. Os erros de regra do próprio Backend (e-mail duplicado, credenciais inválidas, recurso não encontrado) são `AppError` lançados pelos `service`.

## Comparação com o material do professor

| Ponto | Professor | Nosso Backend |
|---|---|---|
| Cliente | `Cliente.java`, console com menu | `javaServerClient`, chamado pelos `services`; pool de conexões duradouras |
| Serialização | `ObjectOutputStream`/`ObjectInputStream` | JSON em linhas |
| Tipo da mensagem | Subclasses de `Comunicado`, `instanceof` | Envelope `{ tipo, dados }`, string |
| `Parceiro` | `receba` / `envie` / `espie` / `adeus`, com `Semaphore` | Mesmos métodos e semântica, sobre `net.Socket`, sem `Semaphore` (event loop do Node) |
| Concorrência | Threads bloqueantes | Assíncrono (`Promise`), várias conexões simultâneas |
| Thread do `ComunicadoDeDesligamento` | Uma por cliente | Um laço de leitura por conexão do pool |
| Saída do cliente | `PedidoParaSair` | Enviado em cada conexão ao encerrar o Backend |
| Camadas extras | Nenhuma | API REST com o Frontend e MongoDB (o professor só tem console) |

## `exemplo/`: documentação de cada arquivo

Em cada pasta há uma subpasta `exemplo/` com um `.md` para cada arquivo `.ts` planejado, explicando o que o arquivo deve ter (e o que **não** é responsabilidade dele) e trazendo um exemplo de implementação. Ao implementar, crie o `.ts` na pasta correspondente; o `.md` fica como referência (e pode ser apagado quando o projeto estiver andando).

**Já implementados como código** (base da Sprint 0): `config/env.ts`, `http/app.ts`, `http/server.ts`, `database/mongo.connection.ts`, `java-client/` (`comunicado`, `parceiro`, `java-server.client`), `middlewares/error-handler.middleware.ts`, `shared/errors/` (`app-error`, `error-codes`) e `modules/sistema/` (`/v1/health` e `/v1/eco`, para testar o caminho até o Servidor). O restante (módulos dos grupos, `auth.middleware`) está só nos `.md`.

## Estrutura de pastas

```
src/
  config/            variáveis de ambiente (env.ts)
  database/          conexão com o MongoDB (mongo.connection.ts)
  http/              app.ts (Express e rotas) e server.ts (listen)
  middlewares/       auth.middleware.ts (JWT) e error-handler.middleware.ts
  java-client/       cliente do Servidor Java (comunicado.ts, parceiro.ts, java-server.client.ts)
  shared/errors/     erro compartilhado (app-error.ts) e tabela code -> status (error-codes.ts)
  modules/
    sistema/         /v1/health e /v1/eco (verificação da base)
    auth/            Grupo 1 — Autenticação & Conta
      mfa/           sub-módulo de MFA
    transactions/    Grupo 2 — Transações (Receitas e Despesas)
    dashboard/       Grupo 3 — Painel Financeiro & Análise de Gastos
    mentor-ia/       Grupo 4 — Mentor Financeiro (IA Generativa)
    goals/           Grupo 5 — Metas Financeiras
    investments/     Grupo 5 — Investimentos
```

## Camadas de cada módulo (`modules/<feature>/`)

| Arquivo | Responsabilidade |
|---|---|
| `*.routes.ts` | Define as rotas HTTP do módulo (método + caminho) e quais usam o `authMiddleware`. |
| `*.controller.ts` | Camada HTTP: lê `req`, valida com o DTO, chama o service e monta a resposta. Erros vão para `next(error)`. |
| `*.service.ts` | Casos de uso: aplica as regras do Backend, usa o repository e, quando precisa, pede uma operação ao Servidor Java pelo `javaServerClient`. |
| `*.repository.ts` | Único arquivo do módulo que fala com o MongoDB (via o model). Sem regra de negócio. |
| `*.model.ts` | Schema Mongoose da coleção. |
| `*.dto.ts` | Schemas de validação (`zod`) e tipos de entrada/saída das rotas. |

Cada grupo só mexe no seu módulo e, em `http/app.ts`, adiciona a linha do `app.use` do seu router. Se precisar de uma operação nova no Servidor, cria o par `PedidoXxx`/`RespostaXxx` junto com quem implementa o lado Java (`../Servidor`).

## Autenticação (JWT)

- `POST /v1/auth/register` e `POST /v1/auth/login` são públicas. No cadastro, o Backend pede o hash da senha ao Servidor Java e grava o usuário; no login, o Servidor confere a senha e, se der certo, o Backend assina o JWT (`{ id, email }`, `JWT_SECRET`, com expiração) e devolve o token.
- O Frontend envia `Authorization: Bearer <token>` nas demais requisições. O `authMiddleware` verifica o token e coloca o usuário em `req.user`; token ausente, inválido ou expirado devolve `401`.
- As rotas de todos os módulos (exceto `register` e `login`) usam o `authMiddleware`, e os controllers sempre usam `req.user.id`, nunca um `userId` vindo do corpo da requisição.

## Pontos em aberto

- **MFA no login:** o `login` devolve `mfaEnabled`; o fluxo completo (token temporário até validar o código) será definido por outro integrante do grupo de Autenticação.
- **Alertas do Mentor IA:** quem os gera (job agendado ou fluxo do chat) ainda não está definido.
- **Contratos Backend↔Servidor:** os tipos de mensagem e seus campos (`PedidoXxx`/`RespostaXxx`) precisam ser os mesmos nos dois lados. A lista completa está em `../Servidor/README.md`.

## Configuração

```bash
cp .env.example .env   # ajuste JWT_SECRET e MONGO_URI
```

| Variável | Para quê |
|---|---|
| `PORT` | Porta da API (padrão 3001) |
| `JWT_SECRET` | Segredo para assinar o JWT |
| `MONGO_URI`, `MONGO_DB` | MongoDB Atlas. Sem `MONGO_URI` o Backend sobe sem banco (só `/v1/health` e `/v1/eco`) |
| `JAVA_SERVER_HOST`, `JAVA_SERVER_PORT` | Onde está o Servidor Java (padrão `localhost:3000`) |
| `JAVA_SERVER_TIMEOUT_MS`, `JAVA_SERVER_POOL_SIZE` | Timeout por pedido (5000) e máximo de conexões simultâneas (5) |
| `GENAI_API_KEY` | Chave da API de IA generativa (Mentor IA) |

O `.env` está no `.gitignore` e nunca deve ser commitado.

### MongoDB Atlas (cada integrante)

O banco é um cluster do **MongoDB Atlas** compartilhado por todos. Não é preciso instalar o MongoDB nem o Docker.

1. **Acesso ao projeto no Atlas:** peça o convite a quem criou o cluster e aceite-o no e-mail.
2. **Usuário do banco** (Atlas → *Database Access*): use o usuário combinado pelo grupo, com permissão de leitura e escrita (`readWrite`) no banco `financeai`.
3. **Liberar o seu IP** (Atlas → *Network Access* → *Add Current IP Address*). Sem isso a conexão é recusada; se o IP mudar (outra rede), adicione-o de novo.
4. **String de conexão** (Atlas → *Connect* → *Drivers*): copie a URI `mongodb+srv://...`, troque `<usuario>` e `<senha>` e coloque em `MONGO_URI` no seu `.env`. Caracteres especiais na senha (`@`, `:`, `/`, `#`) precisam ser codificados (`@` vira `%40`).

Cuidados: a `MONGO_URI` contém a senha do banco e fica **só no seu `.env`** (que está no `.gitignore`); não a cole em issues, PRs, chats nem prints. Se a senha vazar, troque-a no Atlas (*Database Access* → *Edit*) e avise o grupo.

Problemas comuns: `MongoServerSelectionError`/timeout (IP não liberado, ou a rede bloqueia a porta 27017, comum em Wi-Fi de faculdade); `Authentication failed` (usuário/senha errados ou senha não codificada); cluster gratuito pausado por inatividade (retome no painel do Atlas). Ao subir, o Backend mostra `[database] Conectado ao MongoDB`.

## Como rodar

```bash
npm install
npm run dev            # API em http://localhost:3001/v1
```

O Servidor Java deve estar no ar (ver `../Servidor/README.md`) para as rotas que dependem dele; sem ele elas respondem `503`.

Para conferir a base (com o Servidor no ar):

```bash
curl localhost:3001/v1/health                       # {"status":"ok"}: Backend de pé
curl -X POST localhost:3001/v1/eco -H "content-type: application/json" -d '{"oi":1}'
# {"oi":1}: Backend -> socket -> Servidor Java -> de volta
```
