# RespostaProgressoMeta.java — Progresso da meta

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaProgressoMeta"`). Par: `PedidoProgressoMeta`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.goals;

public class RespostaProgressoMeta
{
    public static final String TIPO = "RespostaProgressoMeta";

    private double percentualConcluido;
    private boolean dentroDoPrazo;

    public RespostaProgressoMeta (double percentualConcluido, boolean dentroDoPrazo)
    {
        this.percentualConcluido = percentualConcluido;
        this.dentroDoPrazo = dentroDoPrazo;
    }

    public double getPercentualConcluido ()
    {
        return this.percentualConcluido;
    }

    public boolean getDentroDoPrazo ()
    {
        return this.dentroDoPrazo;
    }
}
```
