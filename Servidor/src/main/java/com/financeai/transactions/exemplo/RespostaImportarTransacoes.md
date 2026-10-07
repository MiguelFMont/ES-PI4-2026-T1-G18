# RespostaImportarTransacoes.java — Quantidade importada

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaImportarTransacoes"`). Par: `PedidoImportarTransacoes`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.transactions;

public class RespostaImportarTransacoes
{
    public static final String TIPO = "RespostaImportarTransacoes";

    private int importadas;

    public RespostaImportarTransacoes (int importadas)
    {
        this.importadas = importadas;
    }

    public int getImportadas ()
    {
        return this.importadas;
    }
}
```
