# RespostaCriarMeta.java — Meta criada

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaCriarMeta"`). Par: `PedidoCriarMeta`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.goals;

import java.util.Map;

public class RespostaCriarMeta
{
    public static final String TIPO = "RespostaCriarMeta";

    private Map<String,Object> meta;

    public RespostaCriarMeta (Map<String,Object> meta)
    {
        this.meta = meta;
    }

    public Map<String,Object> getMeta ()
    {
        return this.meta;
    }
}
```
