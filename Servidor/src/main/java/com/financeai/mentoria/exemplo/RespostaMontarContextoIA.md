# RespostaMontarContextoIA.java — Resposta com o contexto pronto para o prompt

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaMontarContextoIA"`). Par: `PedidoMontarContextoIA`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.mentoria;

public class RespostaMontarContextoIA
{
    public static final String TIPO = "RespostaMontarContextoIA";

    private String contexto;

    public RespostaMontarContextoIA (String contexto)
    {
        this.contexto = contexto;
    }

    public String getContexto ()
    {
        return this.contexto;
    }
}
```
