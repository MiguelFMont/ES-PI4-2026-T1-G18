# PedidoCalcularIndicadores.java — Pedido de cálculo de indicadores

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoCalcularIndicadores"`). Par: `RespostaCalcularIndicadores`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.dashboard;

public class PedidoCalcularIndicadores
{
    public static final String TIPO = "PedidoCalcularIndicadores";

    private double receitas;
    private double despesas;

    public double getReceitas ()
    {
        return this.receitas;
    }

    public double getDespesas ()
    {
        return this.despesas;
    }
}
```
