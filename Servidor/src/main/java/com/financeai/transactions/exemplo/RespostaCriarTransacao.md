# RespostaCriarTransacao.java — Transação criada

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaCriarTransacao"`). Par: `PedidoCriarTransacao`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.transactions;

import java.util.Map;

public class RespostaCriarTransacao
{
    public static final String TIPO = "RespostaCriarTransacao";

    private Map<String,Object> transacao;

    public RespostaCriarTransacao (Map<String,Object> transacao)
    {
        this.transacao = transacao;
    }

    public Map<String,Object> getTransacao ()
    {
        return this.transacao;
    }
}
```
