# PedidoMontarContextoIA.java — Pedido de montagem do contexto da IA

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoMontarContextoIA"`). Par: `RespostaMontarContextoIA`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.mentoria;

import java.util.List;
import java.util.Map;

public class PedidoMontarContextoIA
{
    public static final String TIPO = "PedidoMontarContextoIA";

    private String userId;
    private double receitas;
    private double despesas;
    private List<Map<String,Object>> transacoesRecentes;

    public String getUserId ()
    {
        return this.userId;
    }

    public double getReceitas ()
    {
        return this.receitas;
    }

    public double getDespesas ()
    {
        return this.despesas;
    }

    public List<Map<String,Object>> getTransacoesRecentes ()
    {
        return this.transacoesRecentes;
    }
}
```
