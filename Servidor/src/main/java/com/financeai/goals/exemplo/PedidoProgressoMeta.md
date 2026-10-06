# PedidoProgressoMeta.java — Pedido de cálculo de progresso da meta

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoProgressoMeta"`). Par: `RespostaProgressoMeta`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.goals;

public class PedidoProgressoMeta
{
    public static final String TIPO = "PedidoProgressoMeta";

    private double valorAtual;
    private double valorObjetivo;
    private String prazo;

    public double getValorAtual ()
    {
        return this.valorAtual;
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
