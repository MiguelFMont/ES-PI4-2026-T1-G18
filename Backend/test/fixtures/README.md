# Fixtures

Dados de exemplo para testes, para que eles não dependam de serviços externos.

## `pluggy-sandbox.json`

Contas e transações **reais do sandbox da Pluggy** (conector Pluggy Bank, id 2), obtidas em 09/11/2026: uma conta corrente (31 transações) e um cartão de crédito (17). **São dados fictícios** do ambiente de teste da Pluggy; nenhuma credencial está no arquivo.

- O formato de cada transação é exatamente o que `GET /v2/transactions` devolve em `results`. O arquivo só as agrupa dentro de cada conta, em `transacoes`.
- O `_meta` do arquivo resume as particularidades que a integração precisa tratar (por exemplo, receita ou despesa vem do sinal de `amount`, e o pagamento da fatura do cartão não deve contar como gasto).
- Útil para testar o mapeamento da Pluggy para o nosso modelo (issue #46), a categorização por descrição e a importação sem chamar a API.

Para gerar de novo, crie um item no conector 2 com as credenciais públicas de teste (`user-ok` / `password-ok`) e busque as contas e as transações. As credenciais da aplicação ficam só no `Backend/.env` e nunca entram no repositório.
