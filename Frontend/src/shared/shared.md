
# Módulo Shared (Componentes e Utilitários Compartilhados)

Este diretório contém peças de código genéricas e reaproveitáveis. Ao contrário da pasta `features`, nada aqui deve ter conhecimento sobre regras de negócio específicas (como transações, metas ou mentor de IA).

## Estrutura de Pastas

- **/components**: Peças visuais reutilizáveis de HTML/JS.
  - Exemplo: Um botão customizado (`button.js`, `button.css`), um modal de confirmação padrão (`modal.js`), ou inputs de formulário genéricos. Se três telas diferentes usam o mesmo estilo de cartão (card), o código dele fica aqui.
- **/utils**: Funções auxiliares (helpers) puramente lógicas.
  - Exemplo: Um arquivo `formatters.js` com funções para formatar dinheiro (`R$ 1.500,00`), datas (`DD/MM/AAAA`) ou máscaras de CPF.
  - Exemplo: Um arquivo `validators.js` para checar se um e-mail tem o formato correto ou se uma senha é forte o suficiente.
