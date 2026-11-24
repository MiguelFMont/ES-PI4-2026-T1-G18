# Frontend FinanceAI

HTML, CSS e JavaScript nativos (módulos ES, sem bundler), organizados por features. O Backend entrega o Frontend e a API no mesmo endereço.

## Como rodar

```bash
cd Backend
npm install        # só na primeira vez
npm run dev
```

Abra `http://localhost:3001`. O Backend precisa do `.env` preenchido (ver `Backend/README.md`) e serve:

- `/` abre o `index.html`, a única página: ele tem o menu fixo e um roteador por `#` (`#dashboard`, `#transactions`, `#contas-conectadas`, `#metas`, `#cartao`, `#perfil`, `#mentor-ia`) que troca só o conteúdo de `#app-content` (SPA);
- `/transactions`, `/mentor-ia` e `/dashboard` são atalhos que redirecionam para `/#transactions` etc.; `/login` leva à página de login (`features/auth/components/inicio.html`, independente do `index.html`). Ficam em `Backend/src/http/frontend.ts`: quem criar uma tela nova acrescenta uma linha lá e uma entrada em `TELAS` no `src/app/main.js`;
- `/v1/...` é a API.

Não abra o `index.html` com duplo clique (`file://`): módulos ES e `fetch` não funcionam assim.

### Sessão

As páginas internas exigem um token e, sem ele, voltam para o login (`/login`): entre com uma conta cadastrada. Só para desenvolver sem passar pelo login, dá para gerar um token assinado com o `JWT_SECRET` do seu `.env` e guardá-lo no console do navegador (F12):

```js
localStorage.setItem('@FinanceAI:token', '<token>')
```

Para ver dados de exemplo, rode na pasta `Backend` `npm run seed:transacoes -- <userId>` (transações), `npm run seed:contas -- <userId>` (contas conectadas) ou `npm run seed:grupo5 -- <userId>` (metas, cartão e parcelamentos) com o mesmo `userId` do token.

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

Componentes compartilhados em `src/shared/`: `Calendario.js` (calendário com atalhos de período), `seletor.js` (as listas dos selects: nos modais abrem como "folha" no meio da tela, com o fundo escurecido), `notificacao.js` (`notificar(mensagem, 'sucesso' | 'erro' | 'aviso', { acao })` e `confirmar`), `campos.js` (ligar campos e máscaras) e `escolhaIcone.js` (ícone e cor). O visual com sombras (padrão) ou com bordas finas se escolhe em Minha conta > Preferências, junto com a paleta de cores.

`src/core/vendor/qrcode.js` é a biblioteca `qrcode` (MIT, v1.5.4) já empacotada com o `esbuild`, usada para mostrar o QR Code do MFA no Perfil. É um arquivo gerado: não edite à mão (não há `package.json` na raiz nem no Frontend).

A comunicação com o Backend é REST/HTTP: os services chamam exclusivamente `apiFetch` de `src/core/http/api.js`, que centraliza a URL base (`/v1`, a mesma origem da página), o token JWT, a leitura de respostas e os erros HTTP. Para outro ambiente, defina `window.FINANCEAI_API_URL` antes do módulo principal.

Consulte `src/core/core.md`, `src/features/featuresExemplo.md` e `src/features/auth/authExemplo.md` para os contratos arquiteturais e exemplos, e `docs/contrato-api.md` para os endpoints. A feature `transactions` é o exemplo completo de página com componentes; `contas-conectadas` (Open Finance, Pluggy) segue o mesmo modelo e é um exemplo menor, com um widget de terceiros carregado sob demanda (`utils/pluggyConnect.js`). `goals` (Metas) e `investments` (Cartão de crédito: um card grande e selecionável por cartão (fatura, vencimento, limite e totais, com editar, excluir e novo cartão) e, embaixo, as compras do cartão escolhido; no formulário de transação, o pagamento no crédito pede o cartão e as parcelas, em `transactions/.../CartaoDoLancamento.js`; o portfólio de investimentos simulado tem rotas no Backend mas ficou sem tela, como feature futura) seguem o mesmo modelo (o formulário de transação tem a opção "Vincular a uma meta", em `transactions/.../MetaDoLancamento.js`, que reaproveita o formulário de meta numa janela quando o usuário ainda não tem metas), com formulários que usam o calendário e a máscara de moeda compartilhados, barras de progresso acessíveis (`role="progressbar"`) e a formatação de dinheiro e datas de `shared/utils/moeda.js`.

### Peças compartilhadas de contas, cartões e lançamentos

- `src/shared/components/seletor.js` e `campos.css`: as listas dos selects dos modais ("folha", com o fundo escurecido e a lista no meio da tela; `data-folha` no modal, `data-icones` no select e `data-folha-rodape` para o botão do rodapé).
- `src/shared/utils/avatar.js`, `icones.js` e `components/escolhaIcone.js`: logo do banco (`assets/bancos/`), ícone e cor de contas, cartões e metas.
- `src/shared/components/notificacao.js`: `notificar(mensagem, tipo, { acao: { rotulo: 'Desfazer', aoClicar } })` mostra o botão de desfazer, que some junto com a notificação.
- A aba **Cartão** reaproveita as peças da tela de Transações (`TransactionBarra`, `TransactionLista`, `TransactionForm`, `TransactionDetalhe`): `iniciarPaginaTransacoes(raiz, { signal, escopo })` com `escopo = { cartao(), periodo(), aoAlterar() }` mostra só os lançamentos do cartão escolhido, no mês da fatura. O atributo `data-escopo-cartao` na raiz esconde, por CSS, a coluna e o campo de Meta, a conta, o pagamento e a transferência.
