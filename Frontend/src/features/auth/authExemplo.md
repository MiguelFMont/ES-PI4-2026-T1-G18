# Autenticação e conta

A feature `auth` cobre cadastro, login, recuperação, perfil e preferências. Seus services fazem requisições REST exclusivamente por `apiFetch`, em `src/core/http/api.js`.

## Organização

- `components/`: formulários e interface.
- `services/`: operações REST de autenticação/conta.
- `styles/`: CSS da feature.

## Exemplo de service

```js
import { apiFetch } from '../../../core/http/api.js';
import { saveToken } from '../../../core/session/storage.js';

export async function login(email, senha) {
  const resultado = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
  if (resultado?.token) saveToken(resultado.token);
  return resultado;
}
```

Ajuste rota e DTO ao contrato HTTP do Backend. O endpoint de login é público e não precisa de token; os demais endpoints protegidos recebem o JWT automaticamente pelo wrapper. Não persista senha nem a inclua em logs. Em erros, `ApiError` expõe `message`, `status` e `data` para a interface decidir o feedback. Resposta `401` encerra a sessão e encaminha para `#login`.

