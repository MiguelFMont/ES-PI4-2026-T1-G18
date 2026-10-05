# Componentes de Painel financeiro e análise

Esta pasta contém telas, formulários e elementos visuais exclusivos da feature. Receba dados e callbacks por parâmetros; deixe mensagens WebSocket em `services/`.

## Formulário HTML acessível

```html
<form class="dashboard-form" id="item-form">
  <label for="descricao">Descrição</label>
  <input id="descricao" name="descricao" maxlength="120" required />
  <label for="valor">Valor (R$)</label>
  <input id="valor" name="valor" type="number" min="0.01" step="0.01" required />
  <p id="form-error" role="alert" hidden></p>
  <button type="submit">Salvar</button>
</form>
```

## Componente JavaScript

```js
export function montarFormulario(container, { aoSalvar }) {
  const form = document.createElement("form");
  form.innerHTML = '<label for="descricao">Descrição</label><input id="descricao" name="descricao" required><button>Salvar</button>';
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const dados = Object.fromEntries(new FormData(form));
    await aoSalvar(dados);
  });
  container.replaceChildren(form);
}
```

Para conteúdo recebido do Backend, prefira `textContent` em vez de concatenar em `innerHTML`. Divida telas extensas em componentes pequenos, anuncie erros com `role="alert"` e mantenha foco visível.
