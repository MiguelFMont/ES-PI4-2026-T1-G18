# Módulo Core

O `core/` contém infraestrutura compartilhada e independente das regras de negócio das features.

## HTTP (`http/`)

`http/api.js` exporta `apiFetch` (e o alias `api`), o único ponto de acesso HTTP do frontend. Ele usa `fetch`, aplica a URL base, os cabeçalhos comuns e o token JWT obtido pelo módulo de sessão. Respostas JSON são convertidas para objetos; respostas `204` retornam `null`; falhas de rede e HTTP são lançadas como `ApiError`, com `status` e `data` disponíveis para tratamento pela interface. O Backend responde erros como `{ error: { message, code, details } }`: o `ApiError` expõe `message`, `code` (por exemplo `VALIDATION_ERROR`) e `details` (mapa campo → mensagens, só em erros de validação). Veja `docs/contrato-api.md`. Respostas `401` limpam a sessão e navegam para `#login`.

O Backend entrega o Frontend e a API no mesmo endereço (`http://localhost:3001`), então a URL base padrão é `/v1`, relativa à origem da página (sem CORS). Abrindo o Frontend por outro servidor (por exemplo o Live Server, só para ver uma tela), defina `window.FINANCEAI_API_URL = 'http://localhost:3001/v1'` antes do módulo principal (a porta 3000 é a do Servidor Java de cálculos). Não fixe URLs de endpoint nas telas.

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

`login.js` guarda o endereço do login (`URL_LOGIN`, `/#login`) e `irParaLogin()`. `storage.js` encapsula `localStorage` e padroniza a chave `@FinanceAI:token`, exportando `getToken`, `hasToken`, `saveToken` e `clearSession`. O login salva o token recebido e o logout limpa a sessão. O cliente HTTP envia `Authorization: Bearer <token>` quando há token. Não grave senhas nem registre tokens em logs.

## Telas, roteador e menu (`app/main.js`, `layout/`, `views/`)

O Frontend é um SPA: o `index.html` tem o menu lateral e `<main id="app-content">`, e o roteador de `app/main.js` (por `#`) troca só esse conteúdo, sem recarregar a página. O menu, o tema e a conferência de sessão (sem token vai para `#login`) ficam no roteador e rodam uma vez.

Toda a estrutura das telas é HTML: cada tela é um **fragmento** em `features/<feature>/views/<tela>.html` (só o miolo, sem `<html>`, `<head>` nem menu) com, onde cada componente entra, um `<div data-incluir="/src/features/<feature>/components/Algo/Algo.html"></div>`. Cada componente é uma pasta em `features/<feature>/components/<Nome>/`, com a estrutura em `<Nome>.html` (formulários, listas suspensas e, para conteúdo repetido como a linha de uma tabela, um `<template>`), os estilos em `<Nome>.css` e o comportamento em `<Nome>.js`. O JavaScript não monta marcação: ele só liga o comportamento aos elementos pelos `id`s e `data-campo` (chamar a API, validar, mostrar e esconder estados, preencher textos com `textContent`).

Para criar uma tela: (1) um link no menu do `index.html` com `data-rota="<nome>"` e `href="#<nome>"`; (2) uma entrada em `TELAS` no `app/main.js` com `titulo`, `html`, a lista de `css` e `modulo: () => import(...)`; (3) um `features/<feature>/index.js` que exporta `montar(container)` e `desmontar()`; (4) opcionalmente um atalho em `Backend/src/http/frontend.ts`. Veja `features/transactions/index.js`.

- **`desmontar()` é obrigatório quando a tela liga algo fora do próprio HTML**, porque a página não é recarregada ao sair. O padrão é um `AbortController` criado em `montar()`: passe o `signal` aos `addEventListener` feitos em `document` ou `window` (`{ signal }`), desfaça mudanças no `<body>` ouvindo `signal` (`abort`) e invalide respostas da API que ainda estejam a caminho. Os ouvintes dos elementos da própria tela somem junto com o HTML.
- O roteador carrega os CSS da tela antes de mostrá-la e os remove ao sair; por isso os nomes de classe levam o prefixo da feature (`transactions-...`) para não colidirem.
- `views/includes.js` exporta `incluirFragmentos(container)`, que troca cada `data-incluir` pelo conteúdo do arquivo indicado. Chame dentro de `montar()`, antes de ligar a lógica.
- `layout/menu.js` exporta `ligarMenu()`, que liga os botões `#botao-tema` e `#botao-sair` do menu.
- O destino de quem está sem sessão fica em `session/login.js` (`URL_LOGIN` e `irParaLogin()`), usado pelo `api.js` no `401` e pelo botão Sair.
- Login e dashboard ainda são textos provisórios do próprio `main.js`, até as features correspondentes entregarem as telas.

As páginas são servidas pelo Backend (`npm run dev` na pasta `Backend`, depois `http://localhost:3001`): `/` abre o `index.html`. Os caminhos escritos nos fragmentos (`data-incluir`, links) começam em `/` (a raiz do Frontend), por exemplo `/src/core/styles/global.css`. Os módulos ES não funcionam com `file://`; para só ver uma tela, o Live Server serve se a raiz dele for a pasta `Frontend` (`liveServer.settings.root`: `/Frontend`).

## Tema (`theme/`)

`theme.js` alterna entre tema escuro (padrão) e claro, gravando a escolha em `localStorage` (`@FinanceAI:tema`) e marcando `data-tema` no `<html>`. As cores são variáveis CSS definidas em `styles/global.css`; use-as nos estilos das features em vez de cores fixas.

## Estilos (`styles/`)

A fonte do projeto é a **Nunito** (Google Fonts), definida no `body` de `styles/global.css` com peso 500 (um pouco mais grossa que o normal) e alternativas (`Roboto`, `system-ui`, `sans-serif`) para o caso de ela não carregar. Ela é carregada por três `<link>` no `<head>` de cada página (`preconnect` para `fonts.googleapis.com` e `fonts.gstatic.com`, mais a folha de estilos `css2?family=Nunito`), então **toda página nova precisa desses `<link>`**. Os campos, botões e listas herdam a fonte (`font: inherit`).

Guarda reset, variáveis e estilos globais. Estilos específicos ficam em `styles/` de cada feature.
