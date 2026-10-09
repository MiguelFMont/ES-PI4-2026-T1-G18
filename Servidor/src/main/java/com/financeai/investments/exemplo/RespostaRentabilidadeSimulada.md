# RespostaRentabilidadeSimulada.java — Resposta com patrimônio e rentabilidade

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaRentabilidadeSimulada"`). Par: `PedidoRentabilidadeSimulada`.
- `patrimonioTotal`: soma dos valores projetados (juros compostos pelo número de `meses` do pedido). `ativosComRentabilidade`: os ativos enviados com `taxaMensal`, `valorProjetado` e `rendimento` acrescentados.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class RespostaRentabilidadeSimulada
{
    public static final String TIPO = "RespostaRentabilidadeSimulada";

    private double patrimonioTotal;
    private List<Map<String,Object>> ativosComRentabilidade;

    public RespostaRentabilidadeSimulada (double patrimonioTotal, List<Map<String,Object>> ativosComRentabilidade)
    {
        this.patrimonioTotal = patrimonioTotal;
        this.ativosComRentabilidade = ativosComRentabilidade;
    }

    public double getPatrimonioTotal ()
    {
        return this.patrimonioTotal;
    }

    public List<Map<String,Object>> getAtivosComRentabilidade ()
    {
        return this.ativosComRentabilidade;
    }
}
```
