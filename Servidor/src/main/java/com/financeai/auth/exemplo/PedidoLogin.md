# PedidoLogin.java — Conferência de e-mail e senha

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoLogin"`). Par: `RespostaLogin`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido; campo ausente chega como `null` (ou `0` nos tipos primitivos).

## Exemplo de implementação

```java
package com.financeai.auth;

public class PedidoLogin
{
    public static final String TIPO = "PedidoLogin";

    private String email;
    private String senha;

    public String getEmail ()
    {
        return this.email;
    }

    public String getSenha ()
    {
        return this.senha;
    }
}
```
