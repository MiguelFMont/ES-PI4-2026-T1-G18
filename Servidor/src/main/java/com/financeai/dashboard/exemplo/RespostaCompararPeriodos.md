# RespostaCompararPeriodos.java — Série de totais por período

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaCompararPeriodos"`). Par: `PedidoCompararPeriodos`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.dashboard;

import java.util.List;
import java.util.Map;

public class RespostaCompararPeriodos
{
    public static final String TIPO = "RespostaCompararPeriodos";

    private List<Map<String,Object>> periodos;

    public RespostaCompararPeriodos (List<Map<String,Object>> periodos)
    {
        this.periodos = periodos;
    }

    public List<Map<String,Object>> getPeriodos ()
    {
        return this.periodos;
    }
}
```
