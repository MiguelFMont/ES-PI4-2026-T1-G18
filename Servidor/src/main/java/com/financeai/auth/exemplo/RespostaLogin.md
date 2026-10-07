# RespostaLogin.java — Dados públicos do usuário autenticado

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaLogin"`). Par: `PedidoLogin`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.auth;

public class RespostaLogin
{
    public static final String TIPO = "RespostaLogin";

    private String id;
    private String nome;
    private String email;
    private String plano;
    private boolean mfaEnabled;

    public RespostaLogin (String id, String nome, String email, String plano, boolean mfaEnabled)
    {
        this.id = id;
        this.nome = nome;
        this.email = email;
        this.plano = plano;
        this.mfaEnabled = mfaEnabled;
    }

    public String getId ()
    {
        return this.id;
    }

    public String getNome ()
    {
        return this.nome;
    }

    public String getEmail ()
    {
        return this.email;
    }

    public String getPlano ()
    {
        return this.plano;
    }

    public boolean getMfaEnabled ()
    {
        return this.mfaEnabled;
    }
}
```
