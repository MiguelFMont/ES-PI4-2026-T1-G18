# RespostaAtualizarMeta.java — Meta atualizada

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaAtualizarMeta"`). Par: `PedidoAtualizarMeta`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.goals;

import java.util.Map;

public class RespostaAtualizarMeta
{
    public static final String TIPO = "RespostaAtualizarMeta";

    private Map<String,Object> meta;

    public RespostaAtualizarMeta (Map<String,Object> meta)
    {
        this.meta = meta;
    }

    public Map<String,Object> getMeta ()
    {
        return this.meta;
    }
}
```
