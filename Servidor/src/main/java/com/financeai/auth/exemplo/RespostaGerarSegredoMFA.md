# RespostaGerarSegredoMFA.java — Resposta com o segredo TOTP

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaGerarSegredoMFA"`). Par: `PedidoGerarSegredoMFA`.
- Traz o `segredo` (base32, para guardar no usuário e conferir códigos depois) e a `uri` `otpauth://` (para o Frontend montar o QR code).
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.auth;

public class RespostaGerarSegredoMFA
{
    public static final String TIPO = "RespostaGerarSegredoMFA";

    private String segredo;
    private String uri;

    public RespostaGerarSegredoMFA (String segredo, String uri)
    {
        this.segredo = segredo;
        this.uri = uri;
    }

    public String getSegredo ()
    {
        return this.segredo;
    }

    public String getUri ()
    {
        return this.uri;
    }
}
```
