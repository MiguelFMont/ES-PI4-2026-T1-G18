# Banco.java — Conexão com o MongoDB

## O que deve ter neste arquivo
- O Servidor Java é o **único** componente que acessa o MongoDB. Esta classe guarda o `MongoClient` (um só, compartilhado por todas as `Supervisora`s: o cliente do driver é thread-safe e já mantém seu próprio pool de conexões) e entrega as coleções aos repositórios de cada grupo.
- `iniciar()` lê a URI do Atlas da variável de ambiente `MONGO_URI` (e, opcionalmente, o nome do banco em `MONGO_DB`, padrão `financeai`) e faz um `ping`, para o servidor **falhar ao subir** se não conseguir conectar, e não só na primeira requisição. Deve ser chamado pelo `Main` **antes** de `HandlerRegistry.criarPadrao()`, porque alguns repositórios criam índices ao serem instanciados.
- A URI contém a senha do banco: ela vem do ambiente e nunca é escrita no código nem commitada.
- `id(texto)` converte o identificador recebido do Backend em `ObjectId` e rejeita valores inválidos com `400`.
- `paraMapa(documento)` converte um `Document` do Mongo em um `Map` pronto para o Gson: `_id` vira `id` (texto), datas viram texto ISO-8601 e campos internos (`userId`, `senhaHash`, `mfaSecret`) **nunca** saem do Servidor.
- Não tem regra de negócio: só conexão e conversões.

## Implementado

O código real está em [`../Banco.java`](../Banco.java); este arquivo só explica as decisões.

- `iniciar()` devolve `false` quando `MONGO_URI` não está definida: o Servidor sobe **sem banco** e avisa no console, para que quem ainda não configurou o Atlas consiga testar os sockets e o `/v1/eco`. Se a variável existe e a conexão falha (senha errada, IP não liberado), lança exceção e o `Main` encerra.
- A mensagem de erro mostra só o tipo da exceção do driver, porque o texto dele pode repetir a URI (com a senha).
- `colecao(nome)` sem banco iniciado lança `IllegalStateException("Banco nao iniciado: defina MONGO_URI")`, que a `Supervisora` converte em `INTERNAL_ERROR` e registra no log.
- Timeout de seleção de servidor: 8 s (o padrão do driver é 30 s).
- Use `Banco.colecao("nome")`, `Banco.id(texto)` e `Banco.paraMapa(documento)` nos repositories dos grupos.
