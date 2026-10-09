# Módulo Core

O `core/` contém infraestrutura compartilhada e independente das regras de negócio das features.

## HTTP (`http/`)

`http/api.js` exporta `apiFetch` (e o alias `api`), o único ponto de acesso HTTP do frontend. Ele usa `fetch`, aplica a URL base, os cabeçalhos comuns e o token JWT obtido pelo módulo de sessão. Respostas JSON são convertidas para objetos; respostas `204` retornam `null`; falhas de rede e HTTP são lançadas como `ApiError`, com `status` e `data` disponíveis para tratamento pela interface. Respostas `401` limpam a sessão e navegam para `#login`.

A URL base padrão é `http://localhost:3000/api`. O bootstrap do host pode defini-la antes do módulo principal com `window.FINANCEAI_API_URL`. Não fixe URLs de endpoint nas telas.

Toda feature deve fazer chamadas em seus arquivos `services/` e usar exclusivamente o wrapper; componentes não chamam `fetch`:

```js
import { apiFetch } from '../../../core/http/api.js';

export function listarTransacoes() {
  return apiFetch('/transactions');
}

export function criarTransacao(dados) {
  return apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
}
```

Use caminhos relativos à base e opções padrão do `fetch` (`method`, `body`, `signal`). Trate `ApiError` na feature para apresentar feedback. O wrapper configura `Content-Type: application/json` quando há corpo; para `FormData`, não defina manualmente esse cabeçalho. Endpoints, DTOs e métodos seguem o contrato REST do Backend.

## Sessão (`session/`)

`storage.js` encapsula `localStorage` e padroniza a chave `@FinanceAI:token`, exportando `getToken`, `hasToken`, `saveToken` e `clearSession`. O login salva o token recebido e o logout limpa a sessão. O cliente HTTP envia `Authorization: Bearer <token>` quando há token. Não grave senhas nem registre tokens em logs.

## Estilos (`styles/`)

Guarda reset, variáveis e estilos globais. Estilos específicos ficam em `styles/` de cada feature.
