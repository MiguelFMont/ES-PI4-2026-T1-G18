# PedidoCategorizarTransacao.java — Pedido de categorização automática

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoCategorizarTransacao"`). Par: `RespostaCategorizarTransacao`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.transactions;

public class PedidoCategorizarTransacao
{
    public static final String TIPO = "PedidoCategorizarTransacao";

    private String descricao;
    private double valor;

    public String getDescricao ()
    {
        return this.descricao;
    }

    public double getValor ()
    {
        return this.valor;
    }
}
```
