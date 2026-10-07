
# Módulo Core (Infraestrutura do Frontend)

Este diretório centraliza as configurações globais e os serviços base que serão reaproveitados por todas as features (auth, dashboard, transações, etc.). Nenhuma regra de negócio específica ou tela deve ficar aqui.

## Estrutura de Pastas

- **/ws**: Cliente WebSocket. Gerencia a conexão principal do socket, padroniza o envio e recebimento de mensagens no formato `{ tipo, dados }`, e lida com a autenticação e captura de erros da conexão.
- **/session**: Gerenciamento de sessão. Arquivos responsáveis apenas pela guarda e leitura do token de autenticação do usuário (ex: salvando no localStorage ou sessionStorage).
- **/styles**: Tema global da aplicação. Contém as variáveis de cor gerais, o reset de estilos padrão do navegador e as regras para o modo claro/escuro.
