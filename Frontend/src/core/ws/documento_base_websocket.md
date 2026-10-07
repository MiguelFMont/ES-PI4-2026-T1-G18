# Módulo de WebSocket (`core/ws`)

Este diretório é responsável por gerenciar toda a comunicação em tempo real entre o Frontend e o Backend do nosso projeto, utilizando WebSockets. 

Como não estamos utilizando chamadas HTTP REST padrão para as operações (fetch/axios), este módulo será o "coração" da comunicação da nossa aplicação.

## 📂 Estrutura de Arquivos Sugerida

Para manter o código limpo e organizado, sugerimos a seguinte divisão de arquivos dentro desta pasta:

```text
src/core/ws/
 ├── client.js         # Classe principal que gerencia a conexão WebSocket
 ├── types.js          # (Opcional) Dicionário com os tipos de mensagens permitidos
 └── README.md         # Esta documentação
```

## ⚙️ Padrão de Comunicação

Conforme definido na arquitetura do projeto, todas as mensagens trafegadas pelo WebSocket (enviadas e recebidas) devem seguir estritamente o formato JSON de "envelope":

```json
{
  "tipo": "NomeDoComandoOuEvento",
  "dados": { ... } 
}
```

## 💻 Exemplo de Implementação Base (`client.js`)

Aqui está um esqueleto em JavaScript puro de como o nosso cliente WebSocket deve ser estruturado. Ele aplica o padrão Singleton (garante que só exista uma conexão ativa) e gerencia reconexões e envio estruturado.

```javascript
// Exemplo base para src/core/ws/client.js

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = {}; // Guarda as funções que vão escutar cada 'tipo' de mensagem
  }

  // 1. Inicia a conexão
  connect(url) {
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('✅ Conectado ao servidor WebSocket');
      this.isConnected = true;
    };

    this.socket.onmessage = (event) => {
      try {
        const mensagem = JSON.parse(event.data);
        this.handleMessage(mensagem);
      } catch (error) {
        console.error('❌ Erro ao parsear mensagem do WebSocket', error);
      }
    };

    this.socket.onclose = () => {
      console.log('⚠️ Conexão WebSocket encerrada');
      this.isConnected = false;
      // TODO: Implementar lógica de reconexão automática aqui
    };

    this.socket.onerror = (error) => {
      console.error('❌ Erro no WebSocket', error);
    };
  }

  // 2. Envia mensagens no padrão { tipo, dados }
  send(tipo, dados = {}) {
    if (!this.isConnected) {
      console.error('Não é possível enviar mensagem, WebSocket desconectado.');
      return;
    }
    
    // Aqui podemos injetar o token de sessão antes de enviar!
    const token = localStorage.getItem('auth_token'); // Exemplo de integração com a sessão
    if (token) {
      dados.token = token;
    }

    const payload = JSON.stringify({ tipo, dados });
    this.socket.send(payload);
  }

  // 3. Registra quem quer ouvir um tipo específico de mensagem (ex: Tela de Dashboard)
  on(tipo, callback) {
    if (!this.listeners[tipo]) {
      this.listeners[tipo] = [];
    }
    this.listeners[tipo].push(callback);
  }

  // 4. Distribui a mensagem recebida para quem estiver escutando
  handleMessage(mensagem) {
    const { tipo, dados } = mensagem;
    if (this.listeners[tipo]) {
      this.listeners[tipo].forEach(callback => callback(dados));
    } else {
      console.warn(`Nenhum listener registrado para o tipo: ${tipo}`);
    }
  }
}

// Exporta uma única instância para ser usada em toda a aplicação
export const wsClient = new WebSocketClient();
```

### Como uma Feature (ex: Auth) usaria isso?

```javascript
import { wsClient } from '../../core/ws/client.js';

// Para enviar o login:
wsClient.send('PedidoLogin', { email: 'teste@email.com', senha: '123' });

// Para escutar a resposta do backend:
wsClient.on('RespostaLogin', (dados) => {
    if (dados.sucesso) {
        // Salva na sessão e redireciona
    }
});
```