# RespostaPainelInvestimentos.java — Patrimônio e ativos com rentabilidade

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaPainelInvestimentos"`). Par: `PedidoPainelInvestimentos`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class RespostaPainelInvestimentos
{
    public static final String TIPO = "RespostaPainelInvestimentos";

    private double patrimonioTotal;
    private List<Map<String,Object>> ativos;

    public RespostaPainelInvestimentos (double patrimonioTotal, List<Map<String,Object>> ativos)
    {
        this.patrimonioTotal = patrimonioTotal;
        this.ativos = ativos;
    }

    public double getPatrimonioTotal ()
    {
        return this.patrimonioTotal;
    }

    public List<Map<String,Object>> getAtivos ()
    {
        return this.ativos;
    }
}
```
