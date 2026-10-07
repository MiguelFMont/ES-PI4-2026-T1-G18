# RespostaValidarMFA.java — Resultado da validação do código MFA

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaValidarMFA"`). Par: `PedidoValidarMFA`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.auth;

public class RespostaValidarMFA
{
    public static final String TIPO = "RespostaValidarMFA";

    private boolean valido;

    public RespostaValidarMFA (boolean valido)
    {
        this.valido = valido;
    }

    public boolean getValido ()
    {
        return this.valido;
    }
}
```
