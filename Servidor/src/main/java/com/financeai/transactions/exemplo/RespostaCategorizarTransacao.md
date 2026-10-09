# RespostaCategorizarTransacao.java — Resposta com a categoria sugerida

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaCategorizarTransacao"`). Par: `PedidoCategorizarTransacao`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.transactions;

public class RespostaCategorizarTransacao
{
    public static final String TIPO = "RespostaCategorizarTransacao";

    private String categoria;

    public RespostaCategorizarTransacao (String categoria)
    {
        this.categoria = categoria;
    }

    public String getCategoria ()
    {
        return this.categoria;
    }
}
```
