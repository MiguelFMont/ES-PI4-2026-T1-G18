# PedidoRentabilidadeSimulada.java — Pedido de rentabilidade simulada

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoRentabilidadeSimulada"`). Par: `RespostaRentabilidadeSimulada`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class PedidoRentabilidadeSimulada
{
    public static final String TIPO = "PedidoRentabilidadeSimulada";

    private List<Map<String,Object>> ativos;

    public List<Map<String,Object>> getAtivos ()
    {
        return this.ativos;
    }
}
```
