# PedidoGerarSegredoMFA.java — Pedido de segredo TOTP para o MFA

## O que deve ter neste arquivo
- Pedido enviado pelo Backend ao Servidor (`tipo` `"PedidoGerarSegredoMFA"`). Par: `RespostaGerarSegredoMFA`.
- Usado quando o usuário ativa o MFA: o Servidor gera o segredo (parte criptográfica fica no Java) e devolve também a URI `otpauth://` para o QR code do app autenticador. Quem **guarda** o segredo no usuário é o Backend.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo. Sem construtor: o Gson preenche os campos a partir do JSON recebido.

## Exemplo de implementação

```java
package com.financeai.auth;

public class PedidoGerarSegredoMFA
{
    public static final String TIPO = "PedidoGerarSegredoMFA";

    private String email;

    public String getEmail ()
    {
        return this.email;
    }
}
```
