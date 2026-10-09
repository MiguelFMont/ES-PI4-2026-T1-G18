# TransactionsHandler.java — Handlers do Grupo 2 (Transações)

## O que deve ter neste arquivo
- Registra `PedidoCategorizarTransacao`. O Backend envia a descrição e o valor de um lançamento sem categoria, e o handler devolve a categoria sugerida; o usuário pode sobrescrever depois (isso é do Backend).
- A regra de categorização é do Java. O exemplo usa palavras-chave simples; a versão real pode crescer (tabela de palavras por categoria, faixas de valor) sem o Backend mudar nada, desde que o contrato (`descricao`, `valor` → `categoria`) continue igual.
- Sem acesso ao MongoDB: só calcula sobre o que veio no pedido.

## Exemplo de implementação

```java
package com.financeai.transactions;

import java.util.LinkedHashMap;
import java.util.Map;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class TransactionsHandler
{
    private static final Map<String, String> PALAVRAS_CHAVE = new LinkedHashMap<>();
    static
    {
        PALAVRAS_CHAVE.put ("mercado",     "Alimentacao");
        PALAVRAS_CHAVE.put ("restaurante", "Alimentacao");
        PALAVRAS_CHAVE.put ("uber",        "Transporte");
        PALAVRAS_CHAVE.put ("combustivel", "Transporte");
        PALAVRAS_CHAVE.put ("aluguel",     "Moradia");
        PALAVRAS_CHAVE.put ("farmacia",    "Saude");
    }

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoCategorizarTransacao.TIPO, this::categorizar);
    }

    private Comunicado categorizar (Comunicado pedido) throws Exception
    {
        PedidoCategorizarTransacao p = pedido.dadosComo (PedidoCategorizarTransacao.class);

        String descricao = p.getDescricao().toLowerCase();
        String categoria = "Outros";

        for (Map.Entry<String, String> par : PALAVRAS_CHAVE.entrySet())
            if (descricao.contains (par.getKey()))
            {
                categoria = par.getValue();
                break;
            }

        return Comunicado.de (RespostaCategorizarTransacao.TIPO,
                              new RespostaCategorizarTransacao(categoria));
    }
}
```
