# Integração HTTP da feature

Cada função deste diretório representa uma operação do Backend REST. Importe `apiFetch` de `../../../core/http/api.js`; não chame `fetch` diretamente e não crie um cliente próprio.

```js
import { apiFetch } from '../../../core/http/api.js';

export function listar() {
  return apiFetch('/RECURSO');
}

export function criar(dados) {
  return apiFetch('/RECURSO', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}
```

Substitua `/RECURSO` e os DTOs pelos contratos HTTP publicados pelo Backend. O wrapper adiciona o JWT, interpreta JSON e lança `ApiError` para falhas; a camada de interface deve capturar o erro e mostrar uma mensagem compreensível.
