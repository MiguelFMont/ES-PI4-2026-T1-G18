# Serviços de Autenticação e conta

O Backend atual não expõe HTTP/REST para o frontend. A interface abre um WebSocket com o Backend e envia envelopes JSON `{ tipo, dados }`. O Backend valida e despacha cada tipo; quando necessário, ele conversa com o Servidor Java por uma conexão TCP própria. O navegador não abre socket TCP puro nem se conecta diretamente ao Java.

## Mensagens documentadas pelo Backend (`develop`)

- `Registrar` — pública, conexão anônima.
- `Login` — pública, conexão anônima.
- `Autenticar` — pública, conexão anônima.
- `ObterPerfil` — requer conexão autenticada.
- `HabilitarMfa` — requer conexão autenticada.
- `ValidarMfa` — requer conexão autenticada.

## Contrato de mensagens

```js
{ tipo: "Registrar", dados: { nome: "Ana Silva", email: "ana@email.com", cpf: "00000000000", senha: "senha-segura" } }
```

O Backend responde com `{ "tipo": "Registrar", "dados": { "...": "resultado definido pelo contrato do módulo" } }`. Erros chegam como `{ "tipo": "Erro", "dados": { "message": "...", "code": "..." } }`. Em caso de mensagem inválida ou tipo inexistente, apresente um erro compreensível e mantenha a interface utilizável.

## Cliente WebSocket compartilhado (exemplo)

Centralize o ciclo de conexão em um módulo comum, por exemplo `src/core/wsClient.js`. Como o protocolo atual associa respostas por ordem na conexão, serialize pedidos para evitar respostas ambíguas:

```js
export function criarClienteWS(url) {
  const socket = new WebSocket(url);
  let fila = Promise.resolve();

  function enviar(tipo, dados = {}) {
    const pedido = fila.then(() => new Promise((resolve, reject) => {
      const executar = () => {
        const aoReceber = (event) => {
          let resposta;
          try { resposta = JSON.parse(event.data); }
          catch { socket.removeEventListener("message", aoReceber); reject(new Error("Resposta inválida")); return; }
          socket.removeEventListener("message", aoReceber);
          if (resposta.tipo === "Erro") reject(Object.assign(new Error(resposta.dados?.message ?? "Erro no servidor"), { code: resposta.dados?.code }));
          else if (resposta.tipo === tipo) resolve(resposta.dados);
          else reject(new Error(`Resposta inesperada: ${resposta.tipo}`));
        };
        socket.addEventListener("message", aoReceber);
        socket.send(JSON.stringify({ tipo, dados }));
      };
      if (socket.readyState === WebSocket.OPEN) executar();
      else if (socket.readyState === WebSocket.CONNECTING) socket.addEventListener("open", executar, { once: true });
      else reject(new Error("Conexão com o Backend indisponível"));
    }));
    fila = pedido.catch(() => {});
    return pedido;
  }

  return { socket, enviar };
}
```

Este trecho é um ponto de partida: inclua timeout, tratamento de fechamento/reconexão e cancelamento de listeners na implementação compartilhada. Não abra uma conexão nova para cada clique.

## Uso no módulo

```js
// wsClient é a conexão autenticada compartilhada pela aplicação.
export const registrar = (dados) => wsClient.enviar("Registrar", dados);
export const login = (email, senha) => wsClient.enviar("Login", { email, senha });
export const obterPerfil = () => wsClient.enviar("ObterPerfil", {});
```

Ajuste o payload ao DTO e à mensagem apropriada. Para `auth`, a conexão começa anônima: `Registrar`, `Login` e `Autenticar` são públicas; após login, guarde o token retornado e envie `Autenticar` ao reconectar. As outras operações exigem autenticação. Não inclua `usuario.id` no payload para escolher dono dos dados: o Backend usa a identidade associada à conexão.

Confira os arquivos `Backend/src/modules/auth/exemplo/` na branch `develop` para os contratos detalhados. Nomes e payloads podem evoluir; trate-os como a referência de integração.

O handler atual documenta cadastro, login, retomada de sessão, perfil e MFA. Recuperação de senha, preferências, plano da conta e suporte ainda não aparecem como mensagens nos exemplos do Backend; combine tipos e DTOs antes de implementar essas telas. O fluxo de login com MFA também está indicado no Backend como contrato a definir.
