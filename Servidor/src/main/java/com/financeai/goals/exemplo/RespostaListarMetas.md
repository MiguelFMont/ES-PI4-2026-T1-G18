# RespostaListarMetas.java — Metas do usuário

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaListarMetas"`). Par: `PedidoListarMetas`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.goals;

import java.util.List;
import java.util.Map;

public class RespostaListarMetas
{
    public static final String TIPO = "RespostaListarMetas";

    private List<Map<String,Object>> metas;

    public RespostaListarMetas (List<Map<String,Object>> metas)
    {
        this.metas = metas;
    }

    public List<Map<String,Object>> getMetas ()
    {
        return this.metas;
    }
}
```
