# FinanceAI — Backend

Estrutura base do Backend em **arquitetura limpa por feature**, seguindo a divisão de grupos e a arquitetura de componentes do README principal do repositório (`../README.md`).

## O Backend não é uma API REST

O Backend **não usa Express nem expõe HTTP/REST**. Ele tem dois papéis:

1. **Servidor WebSocket para o Frontend** (`src/ws/`): o Frontend abre uma conexão WebSocket e troca mensagens `{ tipo, dados }` com o Backend. A conexão nasce anônima e é autenticada por mensagem (ver "Autenticação" abaixo).
2. **Cliente do Servidor Java** (`src/java-client/`): o Backend é o cliente do Servidor Java, que segue a arquitetura cliente-servidor por sockets do "Fazedor de Continhas" (`Comunicado`, `Parceiro`, `Aceitadora`, `Supervisora`), adaptada para trocar JSON em linhas em vez de serialização nativa do Java.

```
Frontend --WebSocket--> Backend --socket TCP (JSON)--> Servidor Java
(cliente)               (servidor p/ o front,          (servidor)
                         cliente p/ o Java)
```

O navegador não consegue abrir um socket TCP puro, por isso existe o WebSocket entre Frontend e Backend. O Servidor Java não sabe que existe WebSocket.

### Uma conexão com o Java por usuário

Como no vídeo do professor, onde cada `Cliente` tem a sua conexão e a sua `Supervisora` no servidor, **cada conexão WebSocket do Frontend abre uma conexão TCP própria com o Servidor Java**:

```
Front (usuário A) --WS--> Backend --TCP A--> Java (Supervisora A)
Front (usuário B) --WS--> Backend --TCP B--> Java (Supervisora B)
```

- Não há ID de correlação: cada usuário espera a resposta na sua própria conexão. As respostas são casadas por ordem de chegada, porque o Java trata uma conexão sequencialmente.
- Ao fechar o WebSocket, o Backend envia `PedidoParaSair` e chama `adeus()` (como o `Cliente.java`).
- Se o Servidor Java avisar que vai desligar (`ComunicadoDeDesligamento`), o Backend manda `ServidorDesligando` ao Frontend e fecha a conexão.
- Se o Java estiver fora do ar, a conexão WebSocket é fechada. Queda abrupta só é percebida quando se tenta usar a conexão (erro `503` devolvido ao Frontend).

## Comparação com o material do professor

| Ponto | Professor | Nosso Backend |
|---|---|---|
| Cliente | `Cliente.java`, console com menu | Classe `JavaServerClient`, uma por conexão WebSocket |
| Serialização | `ObjectOutputStream`/`ObjectInputStream` | JSON em linhas (`\n`) |
| Tipo da mensagem | Subclasses de `Comunicado`, `instanceof` | Envelope `{ tipo, dados }`, string |
| `Parceiro` | `receba` / `envie` / `espie` / `adeus`, com `Semaphore` | Mesmos métodos e semântica, sobre `net.Socket`, sem `Semaphore` (event loop do Node) |
| Concorrência | Threads bloqueantes | Assíncrono (`Promise`) |
| Aguardar resposta | `espie()` em loop até `instanceof Resultado` | `enviarPedido`, com fila de pendentes |
| Desligamento do servidor | `TratadoraDeComunicadoDeDesligamento` | `aoDesligar` no `JavaServerClient` |
| Saída do cliente | `PedidoParaSair` | `sair()` envia `PedidoParaSair` e chama `adeus()` |
| Servidor | `Aceitadora` + `Supervisora` com `if/else instanceof` | Mesma estrutura, com `HandlerRegistry` por `tipo` (um handler por grupo) |
| Camadas extras | Nenhuma | WebSocket com o Frontend, MongoDB, módulos por feature |

## `exemplo/`: documentação de cada arquivo

`src/` tem toda a estrutura de pastas, mas nenhum `.ts` ainda. Em cada pasta há uma subpasta `exemplo/` com um `.md` para cada arquivo `.ts` planejado, explicando:

- O que o arquivo deve ter (e o que **não** é responsabilidade dele).
- Um exemplo de implementação em TypeScript.

Exemplo: o futuro `src/modules/auth/auth.service.ts` é documentado em `src/modules/auth/exemplo/auth.service.md`. Ao implementar, crie o `.ts` na pasta correspondente; o `.md` fica como referência.

## Estrutura de pastas

```
src/
  config/            variáveis de ambiente (env.ts)
  database/          conexão com o MongoDB (mongo.connection.ts)
  java-client/       cliente do Servidor Java (comunicado.ts, parceiro.ts, java-server.client.ts)
  shared/errors/     erro de negócio compartilhado (app-error.ts)
  ws/                servidor WebSocket para o Frontend (server.ts, connection.ts, dispatcher.ts, ws-auth.ts)
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
| `*.handler.ts` | Registra no `ws/dispatcher.ts` a função que trata cada `tipo` de mensagem WebSocket do módulo. Recebe `(dados, { usuario, java })`. |
| `*.service.ts` | Regra de negócio. Usa o `repository` para persistência e o `java` (recebido por parâmetro) quando a regra depende do Servidor Java. |
| `*.repository.ts` | Acesso ao MongoDB (via o `*.model.ts` do módulo), sempre restrito ao usuário dono do dado. |
| `*.dto.ts` | Schemas de validação (`zod`) e tipos de entrada/saída. |
| `*.model.ts` | Schema(s) Mongoose da(s) coleção(ões) do módulo. |

Cada grupo só mexe no seu módulo e, em `ws/server.ts`, adiciona a linha de `import` do seu `*.handler.ts`.

## Autenticação (JWT por conexão)

A conexão WebSocket **nasce anônima** (sem token no handshake, nem na URL). A autenticação vale só para aquela conexão e fica guardada nela, como o estado da `Supervisora` do professor.

1. Uma conexão anônima só aceita mensagens **públicas**: `Registrar`, `Login` e `Autenticar`. Qualquer outra recebe erro `401`.
2. `Login` valida a senha (hash verificado pelo Servidor Java), o Backend assina o JWT (`{ id, email }`, `JWT_SECRET`, com expiração) e marca a conexão como autenticada.
3. O Frontend guarda o token. Ao recarregar a página ou reconectar, envia `Autenticar` com o token e a conexão volta a ser autenticada sem pedir a senha.
4. No código: `dispatcher.registrarPublico(...)` para mensagens públicas e `dispatcher.registrar(...)` para as que exigem usuário (o handler recebe `{ usuario, java }`, com `usuario` garantido).

O token só é verificado no `Autenticar`: uma conexão já aberta continua válida depois de o token expirar.

## Pontos em aberto (contratos do Sprint 0)

- **MFA no login:** como o `Login` devolve `mfaRequired` e só autentica a conexão depois de `ValidarMfa` fica a definir pelo grupo de Autenticação.
- **Ordem das respostas do Java:** a correlação por ordem exige que o Servidor Java responda cada pedido na ordem em que recebeu, e que só use `enviarPedido` para pedidos que têm resposta.

## Como rodar (depois que os `.ts` reais existirem)

```bash
npm install
cp .env.example .env   # preencher MONGO_URI, JWT_SECRET, etc.
npm run dev
```
