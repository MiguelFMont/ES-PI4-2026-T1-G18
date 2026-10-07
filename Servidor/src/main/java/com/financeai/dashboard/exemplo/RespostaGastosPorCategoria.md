# RespostaGastosPorCategoria.java — Total de gastos por categoria

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaGastosPorCategoria"`). Par: `PedidoGastosPorCategoria`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.dashboard;

import java.util.List;
import java.util.Map;

public class RespostaGastosPorCategoria
{
    public static final String TIPO = "RespostaGastosPorCategoria";

    private List<Map<String,Object>> categorias;

    public RespostaGastosPorCategoria (List<Map<String,Object>> categorias)
    {
        this.categorias = categorias;
    }

    public List<Map<String,Object>> getCategorias ()
    {
        return this.categorias;
    }
}
```
