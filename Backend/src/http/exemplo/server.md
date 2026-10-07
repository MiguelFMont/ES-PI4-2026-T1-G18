# server.ts — Ponto de entrada (bootstrap da aplicação)

## O que deve ter neste arquivo
- Sobe o servidor HTTP com `app.listen(env.PORT)`. É o único arquivo que abre uma porta de rede, por isso fica separado do `app.ts` (que os testes podem importar sem abrir porta).
- **Não conecta em banco de dados**: o Backend não acessa o MongoDB (quem faz isso é o Servidor Java).
- **Não conecta no Servidor Java aqui**: cada chamada ao Servidor abre a sua própria conexão (ver `java-client/java-server.client.ts`). Se o Servidor estiver fora do ar, as rotas que dependem dele respondem `503`; o próprio Backend sobe normalmente.

## Exemplo de implementação

```ts
// src/http/server.ts
import { app } from "./app";
import { env } from "../config/env";

app.listen(env.PORT, () => {
  console.log(`[server] Backend rodando em http://localhost:${env.PORT}/v1`);
});
```
