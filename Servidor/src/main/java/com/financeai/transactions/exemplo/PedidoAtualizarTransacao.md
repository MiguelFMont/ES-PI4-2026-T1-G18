# PedidoAtualizarTransacao.java — Atualização de transação

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoAtualizarTransacao"`). Par: `RespostaAtualizarTransacao`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido; campo ausente chega como `null` (ou `0` nos tipos primitivos).

## Exemplo de implementação

```java
package com.financeai.transactions;

public class PedidoAtualizarTransacao
{
    public static final String TIPO = "PedidoAtualizarTransacao";

    private String userId;
    private String id;
    private String tipo;
    private Double valor;
    private String categoria;
    private String data;
    private String descricao;

    public String getUserId ()
    {
        return this.userId;
    }

    public String getId ()
    {
        return this.id;
    }

    public String getTipo ()
    {
        return this.tipo;
    }

    public Double getValor ()
    {
        return this.valor;
    }

    public String getCategoria ()
    {
        return this.categoria;
    }

    public String getData ()
    {
        return this.data;
    }

    public String getDescricao ()
    {
        return this.descricao;
    }
}
```
