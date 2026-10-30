# Frontend FinanceAI

HTML, CSS e JavaScript nativos (módulos ES, sem bundler), organizados por features. O Backend entrega o Frontend e a API no mesmo endereço.

## Como rodar

```bash
cd Backend
npm install        # só na primeira vez
npm run dev
```

Abra `http://localhost:3001`. O Backend precisa do `.env` preenchido (ver `Backend/README.md`) e serve:

- `/` abre o `index.html`, a única página: ele tem o menu fixo e um roteador por `#` (`#dashboard`, `#transactions`) que troca só o conteúdo de `#app-content` (SPA);
- `/transactions` e `/dashboard` são atalhos que redirecionam para `/#transactions` etc.; `/login` leva à página de login (`features/auth/components/inicio.html`, independente do `index.html`). Ficam em `Backend/src/http/frontend.ts`: quem criar uma tela nova acrescenta uma linha lá e uma entrada em `TELAS` no `src/app/main.js`;
- `/v1/...` é a API.

Não abra o `index.html` com duplo clique (`file://`): módulos ES e `fetch` não funcionam assim.

### Sessão provisória (enquanto o login do Grupo 1 não existe)

As páginas internas exigem um token e, sem ele, voltam para o login. Para desenvolver, gere um token assinado com o `JWT_SECRET` do seu `.env` e guarde-o no console do navegador (F12):

```js
localStorage.setItem('@FinanceAI:token', '<token>')
```

Para ver dados de exemplo, rode na pasta `Backend` `npm run seed:transacoes -- <userId>` com o mesmo `userId` do token.

### Só para ver uma tela (Live Server)

Dá para usar o Live Server do VS Code se a raiz dele for a pasta `Frontend` (`liveServer.settings.root`: `/Frontend`), porque os caminhos das páginas começam em `/`. Como a API não está nesse servidor, defina antes do módulo principal `window.FINANCEAI_API_URL = 'http://localhost:3001/v1'` (com o Backend ligado).

## Organização

```text
index.html                 shell com roteador por # (dashboard e telas das features; o login é uma página à parte)
src/
  app/main.js              inicializa as rotas e protege as privadas
  core/                    infraestrutura compartilhada (HTTP, sessão, tema, menu, inclusão de componentes)
  shared/                  componentes e estilos reutilizáveis por várias features
  features/<feature>/      uma pasta por funcionalidade
    views/                   a tela (HTML, só o miolo: o menu fica no index.html)
    components/<Nome>/       um componente = <Nome>.html (estrutura) + <Nome>.js (comportamento)
    services/                chamadas ao Backend
    utils/                   regras sem tela (validação, formatação...)
    styles/                  CSS da feature
    index.js                 entrada da tela: montar(container) liga tudo e desmontar() desliga ao sair
```

Regra: **a estrutura é HTML; o JavaScript só cuida de comportamento** (chamar a API, validar, preencher dados). Textos vindos da API entram sempre por `textContent`.

Componentes compartilhados em `src/shared/`: `Calendario.js` (calendário com atalhos de período), `seletor.js` (lista dos selects que abre ao passar o mouse), `notificacao.js` (`notificar(mensagem, 'sucesso' | 'erro' | 'info')`) e `campos.js` (ligar campos e `aceitarSomenteNumeros`). Para comparar o visual sem sombras, troque o `global.css` do `index.html` por `global-sem-sombras.css`.

A comunicação com o Backend é REST/HTTP: os services chamam exclusivamente `apiFetch` de `src/core/http/api.js`, que centraliza a URL base (`/v1`, a mesma origem da página), o token JWT, a leitura de respostas e os erros HTTP. Para outro ambiente, defina `window.FINANCEAI_API_URL` antes do módulo principal.

Consulte `src/core/core.md`, `src/features/featuresExemplo.md` e `src/features/auth/authExemplo.md` para os contratos arquiteturais e exemplos, e `docs/contrato-api.md` para os endpoints. A feature `transactions` é o exemplo completo de página com componentes.
