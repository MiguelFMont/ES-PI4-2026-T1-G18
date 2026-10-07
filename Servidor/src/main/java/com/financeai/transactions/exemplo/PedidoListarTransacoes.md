# PedidoListarTransacoes.java — Listagem com filtros

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoListarTransacoes"`). Par: `RespostaListarTransacoes`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido; campo ausente chega como `null` (ou `0` nos tipos primitivos).

## Exemplo de implementação

```java
package com.financeai.transactions;

public class PedidoListarTransacoes
{
    public static final String TIPO = "PedidoListarTransacoes";

    private String userId;
    private String categoria;
    private String origem;
    private String dataInicio;
    private String dataFim;

    public String getUserId ()
    {
        return this.userId;
    }

    public String getCategoria ()
    {
        return this.categoria;
    }

    public String getOrigem ()
    {
        return this.origem;
    }

    public String getDataInicio ()
    {
        return this.dataInicio;
    }

    public String getDataFim ()
    {
        return this.dataFim;
    }
}
```
