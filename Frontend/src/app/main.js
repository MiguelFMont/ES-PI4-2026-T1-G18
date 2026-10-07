// src/app/main.js
// Arquivo principal de Inicialização (Bootstrap) e Roteamento

// Exemplo de importações futuras que você fará do seu módulo 'core'
// import { connectWebSocket } from '../core/ws/client.js';
// import { getToken } from '../core/session/storage.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ FinanceAI Frontend iniciado!');
    
    const appContent = document.getElementById('app-content');

    // ==========================================
    // 1. BOOTSTRAP (Inicialização)
    // ==========================================
    function initApp() {
        // Exemplo de lógica de inicialização:
        // const token = getToken();
        // if (token) {
        //     connectWebSocket(token);
        // } else {
        //     console.warn('Sem sessão ativa. Redirecionando para login...');
        //     window.location.hash = '#login';
        // }
        
        // Inicia o roteador pela primeira vez
        handleRoute();
    }

    // ==========================================
    // 2. ROTEAMENTO SIMPLES (Baseado em Hash)
    // ==========================================
    function handleRoute() {
        // Pega a rota da URL (ex: #dashboard), se estiver vazia o padrão é #login
        const hash = window.location.hash || '#login';

        switch (hash) {
            case '#login':
                // Aqui você futuramente injetará o HTML do auth/components/login.js
                appContent.innerHTML = `
                    <div style="text-align: center; margin-top: 50px;">
                        <h2>Entrar no FinanceAI</h2>
                        <p>Tela de Login simulada</p>
                        <a href="#dashboard">Entrar (Simulação)</a>
                    </div>
                `;
                break;
            case '#dashboard':
                // Aqui você injetará o HTML do dashboard/components/dashboard.js
                appContent.innerHTML = `
                    <div style="padding: 20px;">
                        <h2>Dashboard</h2>
                        <p>Bem-vindo ao seu painel financeiro.</p>
                        <a href="#login">Sair</a>
                    </div>
                `;
                break;
            default:
                appContent.innerHTML = `
                    <div style="padding: 20px; color: red;">
                        <h2>Erro 404</h2>
                        <p>Página não encontrada!</p>
                        <a href="#login">Voltar para o início</a>
                    </div>
                `;
                break;
        }
    }

    // Fica escutando as mudanças na URL (quando o usuário clica em links)
    window.addEventListener('hashchange', handleRoute);

    // Dispara a inicialização
    initApp();
});