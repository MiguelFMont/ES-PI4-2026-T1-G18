# RespostaListarTransacoes.java — Lista de transações

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaListarTransacoes"`). Par: `PedidoListarTransacoes`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.transactions;

import java.util.List;
import java.util.Map;

public class RespostaListarTransacoes
{
    public static final String TIPO = "RespostaListarTransacoes";

    private List<Map<String,Object>> transacoes;

    public RespostaListarTransacoes (List<Map<String,Object>> transacoes)
    {
        this.transacoes = transacoes;
    }

    public List<Map<String,Object>> getTransacoes ()
    {
        return this.transacoes;
    }
}
```
