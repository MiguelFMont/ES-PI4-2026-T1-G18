# PedidoValidarMFA.java — Pedido de validação de código MFA

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoValidarMFA"`). Par: `RespostaValidarMFA`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.auth;

public class PedidoValidarMFA
{
    public static final String TIPO = "PedidoValidarMFA";

    private String userId;
    private String segredo;
    private String codigo;

    public String getUserId ()
    {
        return this.userId;
    }

    public String getSegredo ()
    {
        return this.segredo;
    }

    public String getCodigo ()
    {
        return this.codigo;
    }
}
```
