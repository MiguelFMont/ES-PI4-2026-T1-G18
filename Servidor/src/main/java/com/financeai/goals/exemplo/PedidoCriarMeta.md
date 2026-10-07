# PedidoCriarMeta.java — Criação de meta

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoCriarMeta"`). Par: `RespostaCriarMeta`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido; campo ausente chega como `null` (ou `0` nos tipos primitivos).

## Exemplo de implementação

```java
package com.financeai.goals;

public class PedidoCriarMeta
{
    public static final String TIPO = "PedidoCriarMeta";

    private String userId;
    private String titulo;
    private double valorObjetivo;
    private String prazo;

    public String getUserId ()
    {
        return this.userId;
    }

    public String getTitulo ()
    {
        return this.titulo;
    }

    public double getValorObjetivo ()
    {
        return this.valorObjetivo;
    }

    public String getPrazo ()
    {
        return this.prazo;
    }
}
```
