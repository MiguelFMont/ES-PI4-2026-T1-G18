# Módulo de Sessão (`core/session`)

Este diretório é exclusivamente responsável por guardar e recuperar informações de estado do usuário logado na máquina local (navegador). 

A responsabilidade principal aqui é lidar com o **Token de Autenticação** e, opcionalmente, dados básicos do perfil do usuário em cache, abstraindo o uso nativo do `localStorage` ou `sessionStorage`.

## 📂 Estrutura de Arquivos Sugerida

```text
src/core/session/
 ├── storage.js        # Funções para salvar, ler e limpar dados de sessão
 └── README.md         # Esta documentação
```

## ⚙️ Por que usar um arquivo separado em vez de chamar `localStorage` direto?

1. **Segurança e Manutenção:** Se no futuro decidirmos mudar de `localStorage` para `sessionStorage` ou usar cookies criptografados, alteramos o código em **apenas um lugar** (nesta pasta), sem quebrar as telas de *Auth*, *Dashboard*, etc.
2. **Padronização:** Evita que um desenvolvedor grave a chave como `"token"` e outro tente ler buscando `"auth_token"`.
3. **Parseamento automático:** Facilita salvar objetos (convertendo para JSON automaticamente ao salvar e ao ler).

## 💻 Exemplo de Implementação Base (`storage.js`)

Aqui está um esqueleto em JavaScript puro de como gerenciar a sessão de forma segura e padronizada.

```javascript
// Exemplo base para src/core/session/storage.js

// Constantes padronizadas para as chaves
const KEYS = {
  TOKEN: '@FinanceAI:token',
  USER: '@FinanceAI:user'
};

export const SessionManager = {
  
  // ==========================================
  // GERENCIAMENTO DE TOKEN
  // ==========================================
  
  saveToken(token) {
    localStorage.setItem(KEYS.TOKEN, token);
  },

  getToken() {
    return localStorage.getItem(KEYS.TOKEN);
  },

  hasToken() {
    return !!this.getToken();
  },

  // ==========================================
  // GERENCIAMENTO DE DADOS DO USUÁRIO
  // ==========================================

  saveUser(userData) {
    // Converte o objeto para string antes de salvar
    localStorage.setItem(KEYS.USER, JSON.stringify(userData));
  },

  getUser() {
    const data = localStorage.getItem(KEYS.USER);
    if (!data) return null;
    
    try {
      // Converte a string de volta para objeto
      return JSON.parse(data);
    } catch (error) {
      console.error('Erro ao ler dados do usuário da sessão', error);
      return null;
    }
  },

  // ==========================================
  // LOGOUT (Limpar Sessão)
  // ==========================================

  clearSession() {
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.USER);
    console.log('Sessão encerrada com sucesso.');
  }
};
```

### Como uma Feature usaria isso?

**No arquivo de roteamento ou de proteção de tela (`app/main.js`):**
```javascript
import { SessionManager } from '../core/session/storage.js';

function verificarAcesso() {
    if (!SessionManager.hasToken()) {
        window.location.href = '/login.html'; // Redireciona se não estiver logado
    }
}
```

**Após um login bem-sucedido na tela de Auth:**
```javascript
import { SessionManager } from '../../core/session/storage.js';

// ... após receber resposta positiva do WebSocket ...
SessionManager.saveToken(dadosRetorno.token);
SessionManager.saveUser({ nome: dadosRetorno.nome, email: dadosRetorno.email });
```