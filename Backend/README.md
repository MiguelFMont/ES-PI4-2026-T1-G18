# FinanceAI — Backend

Estrutura base do Backend em **arquitetura limpa por feature**, seguindo a divisão de grupos e a arquitetura de componentes do README principal do repositório (`../README.md`).

## O que o Backend faz

O Backend é a **API REST (Node.js, TypeScript e Express)** do FinanceAI e funciona como um **gateway**: recebe as requisições HTTP do Frontend, valida e autentica, e repassa o trabalho ao Servidor Java. Ele **não acessa o banco de dados**: o Servidor Java é o único dono do MongoDB e das regras de negócio.

1. **API HTTP para o Frontend** (`src/http/`): rotas sob `/v1/...` (`/v1/auth`, `/v1/transactions`...), JSON e autenticação por JWT no header `Authorization: Bearer <token>`. É o Backend que assina e verifica o JWT.
2. **Cliente do Servidor Java** (`src/java-client/`): cada operação de negócio vira um pedido ao Servidor, por socket TCP com mensagens JSON em linhas. O Servidor segue o sistema cliente-servidor do "Fazedor de Continhas" ensinado em aula (`Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`), e a pasta `java-client/` é uma porta quase literal de `Comunicado.java`/`Parceiro.java`/`Cliente.java`, mantendo os nomes `envie`/`receba`/`espie`.

```
Frontend --HTTP (REST/JSON)--> Backend --socket TCP (JSON)--> Servidor Java --> MongoDB (Atlas)
(navegador)                    (gateway: rotas,                (dono dos dados
                                validação, JWT)                 e das regras)
```

O navegador não consegue abrir um socket TCP puro, por isso existe o Backend: ele traduz HTTP em mensagens de socket para o Servidor Java.

### O que o Backend faz e não faz

| Faz | Não faz |
|---|---|
| Expor as rotas HTTP e validar o corpo das requisições (`zod`) | Acessar o MongoDB (não há Mongoose, `model` nem `repository`) |
| Assinar e verificar o JWT (`JWT_SECRET`) | Guardar senhas, hashes ou segredos de MFA |
| Repassar cada operação ao Servidor Java e devolver o resultado | Aplicar regras de negócio (categorização, indicadores, progresso de meta...) |
| Chamar serviços externos que precisam de internet e chave (API de IA generativa, Pluggy) | |

Como o Servidor Java decide o resultado das operações, ele devolve os erros de negócio só com um `code` (ver abaixo), e o Backend traduz o `code` em status HTTP.

### Uma conexão com o Java por chamada

HTTP não mantém conexão aberta, então cada chamada ao Servidor Java segue o ciclo de vida de um `Cliente` do professor: **conecta, faz um pedido, lê a resposta, envia `PedidoParaSair` e fecha**. Cada chamada tem a sua própria `Supervisora` no Servidor, então:

- não há ID de correlação: duas requisições simultâneas nunca misturam respostas;
- há um **timeout** (`JAVA_SERVER_TIMEOUT_MS`): se o Servidor não responder, a rota devolve `503`;
- **Como o Servidor é dono dos dados, se ele estiver fora do ar a API inteira falha** (`503`), exceto o que não depende dele.

### Erros vindos do Servidor

Quando uma regra de negócio falha, o Servidor responde `{"tipo":"Erro","dados":{"code":"EMAIL_IN_USE","message":"..."}}`. O `java-client` consulta a tabela `code → status` (`shared/errors/error-codes.ts`) e cria um `AppError` com o status HTTP, o `code` e a `message`; o `error-handler.middleware` devolve a resposta. Assim o Servidor Java não conhece HTTP: ele diz *o que* aconteceu (`EMAIL_IN_USE`) e o Backend decide que isso é `409`. Um `code` fora da tabela vira `502 JAVA_SERVER_ERROR`.

## Comparação com o material do professor

| Ponto | Professor | Nosso Backend |
|---|---|---|
| Cliente | `Cliente.java`, console com menu | `javaServerClient`, chamado pelos `services`; uma conexão por chamada |
| Serialização | `ObjectOutputStream`/`ObjectInputStream` | JSON em linhas (`\n`) |
| Tipo da mensagem | Subclasses de `Comunicado`, `instanceof` | Envelope `{ tipo, dados }`, string |
| `Parceiro` | `receba` / `envie` / `espie` / `adeus`, com `Semaphore` | Mesmos métodos e semântica, sobre `net.Socket`, sem `Semaphore` (event loop do Node) |
| Concorrência | Threads bloqueantes | Assíncrono (`Promise`) |
| Saída do cliente | `PedidoParaSair` | Enviado no fim de cada chamada |
| Camadas extras | Nenhuma | API REST com o Frontend (o professor só tem console) |

## `exemplo/`: documentação de cada arquivo

`src/` tem toda a estrutura de pastas, mas nenhum `.ts` ainda. Em cada pasta há uma subpasta `exemplo/` com um `.md` para cada arquivo `.ts` planejado, explicando:

- O que o arquivo deve ter (e o que **não** é responsabilidade dele).
- Um exemplo de implementação em TypeScript.

Exemplo: o futuro `src/modules/auth/auth.service.ts` é documentado em `src/modules/auth/exemplo/auth.service.md`. Ao implementar, crie o `.ts` na pasta correspondente; o `.md` fica como referência.

## Estrutura de pastas

```
src/
  config/            variáveis de ambiente (env.ts)
  http/              app.ts (Express e rotas) e server.ts (listen)
  middlewares/       auth.middleware.ts (JWT) e error-handler.middleware.ts
  java-client/       cliente do Servidor Java (comunicado.ts, parceiro.ts, java-server.client.ts)
  shared/errors/     erro compartilhado (app-error.ts)
  modules/
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
| `*.service.ts` | Casos de uso: monta o pedido, chama o `javaServerClient` e devolve o resultado. Pode orquestrar vários pedidos e serviços externos (ex.: Mentor IA). |
| `*.dto.ts` | Schemas de validação (`zod`) e tipos de entrada/saída das rotas. |

Cada grupo só mexe no seu módulo e, em `http/app.ts`, adiciona a linha do `app.use` do seu router. Os dados, as regras e o acesso ao banco do grupo ficam na pasta do grupo no **Servidor** (`../Servidor`).

## Autenticação (JWT)

- `POST /v1/auth/register` e `POST /v1/auth/login` são públicas. O Servidor Java confere e-mail e senha (o hash fica no banco, só no Servidor); se o login der certo, o Backend assina o JWT (`{ id, email }`, `JWT_SECRET`, com expiração) e devolve o token.
- O Frontend envia `Authorization: Bearer <token>` nas demais requisições. O `authMiddleware` verifica o token e coloca o usuário em `req.user`; token ausente, inválido ou expirado devolve `401`.
- As rotas de todos os módulos (exceto `register` e `login`) usam o `authMiddleware`, e os controllers sempre usam `req.user.id`, nunca um `userId` vindo do corpo da requisição. O Servidor confia no `userId` que o Backend envia, por isso só o Backend deve conseguir alcançá-lo.

## Pontos em aberto (contratos do Sprint 0)

- **MFA no login:** como o `login` devolve `mfaEnabled` e só entrega o token final depois de validar o código fica a definir pelo grupo de Autenticação.
- **Contratos Backend↔Servidor:** os tipos de mensagem e seus payloads (`PedidoXxx`/`RespostaXxx`) precisam ser os mesmos nos dois lados. A lista completa está no `../Servidor/README.md`.

## Configuração

O banco de dados (MongoDB Atlas) é configurado **no Servidor Java**, não aqui: ver `../Servidor/README.md`. O Backend só precisa saber onde está o Servidor.

```bash
cp .env.example .env   # PORT, JWT_SECRET, JAVA_SERVER_HOST/PORT, GENAI_API_KEY
```

O `.env` está no `.gitignore` e nunca deve ser commitado.

## Como rodar (depois que os `.ts` reais existirem)

O Servidor Java deve estar no ar (ver `../Servidor/README.md`): sem ele, as rotas respondem `503`.

```bash
npm install
npm run dev            # API em http://localhost:3001/v1
```
