# PedidoValidarSenha.java — Pedido de conferência de senha

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoValidarSenha"`). Par: `RespostaValidarSenha`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.auth;

public class PedidoValidarSenha
{
    public static final String TIPO = "PedidoValidarSenha";

    private String senha;
    private String hash;

    public String getSenha ()
    {
        return this.senha;
    }

    public String getHash ()
    {
        return this.hash;
    }
}
```
