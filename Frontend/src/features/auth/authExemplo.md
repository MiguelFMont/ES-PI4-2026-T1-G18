# Autenticação e conta

Esta feature cobre cadastro com nome, e-mail, CPF e senha, login, recuperação de senha, MFA opcional, perfil e preferências (tema e ocultação de valores), plano Free/Pro e suporte. Consulte os contratos do Backend em `Backend/src/modules/auth/exemplo/` e `Backend/src/modules/auth/mfa/exemplo/`.

## Organização

```text
auth/
├── components/  # formulários de login, cadastro, recuperação e perfil
├── services/    # mensagens WebSocket de autenticação
└── styles/      # estilos das telas de conta
```

## Exemplo: formulário de login

```html
<form id="login-form">
  <label for="email">E-mail</label>
  <input id="email" name="email" type="email" autocomplete="email" required />
  <label for="senha">Senha</label>
  <input id="senha" name="senha" type="password" autocomplete="current-password" required />
  <p id="login-error" role="alert" hidden></p>
  <button type="submit">Entrar</button>
</form>
```

```js
import { login } from "./services/authService.js";

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const dados = Object.fromEntries(new FormData(form));
  const aviso = document.querySelector("#login-error");
  aviso.hidden = true;
  try {
    const resultado = await login(dados.email, dados.senha);
    // O Backend retorna token e usuário; a política de armazenamento deve ser definida
    // com a equipe. Ao abrir uma nova conexão, envie Autenticar com o token salvo.
    console.info("Login concluído", resultado.usuario);
  } catch (erro) {
    aviso.textContent = erro.message || "Não foi possível entrar. Confira seus dados.";
    aviso.hidden = false;
  }
});
```

A conexão WebSocket nasce anônima. `Registrar`, `Login` e `Autenticar` são mensagens públicas; `ObterPerfil`, `HabilitarMfa` e `ValidarMfa` exigem sessão autenticada. Se o Backend sinalizar MFA pendente, conclua `ValidarMfa` antes de considerar o login finalizado. Não envie senha em logs nem persista senha no navegador.
