# Módulo de Sessão (`core/session`)

Este módulo centraliza o armazenamento local do token de autenticação. `storage.js` exporta `saveToken`, `getToken`, `hasToken` e `clearSession`, usando a chave `@FinanceAI:token` no `localStorage`.

Após o login REST retornar um token, o service de autenticação deve persistir com `saveToken(token)`. O módulo `core/http/api.js` consulta `getToken()` antes de cada requisição protegida e envia `Authorization: Bearer <token>`. Ao receber HTTP 401, o wrapper remove o token e navega para `#login`. No logout, chame `clearSession()`.

Não armazene senhas no navegador nem escreva tokens em logs. O bootstrap usa `hasToken()` para impedir a entrada em rotas privadas sem sessão.
