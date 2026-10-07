# RespostaRegistrarUsuario.java — Usuário cadastrado

## O que deve ter neste arquivo
- Resposta enviada pelo Servidor ao Backend (`tipo` `"RespostaRegistrarUsuario"`). Par: `PedidoRegistrarUsuario`.
- É um POJO simples que representa o campo `dados` do `Comunicado`. Os nomes dos campos são exatamente os do JSON trocado com o Backend, então qualquer mudança aqui é uma mudança de **contrato** e precisa ser combinada com o Backend.
- Constante `TIPO` com o nome do tipo, para o handler e o `HandlerRegistry` não repetirem a string. Construtor com todos os campos, usado pelo handler para montar a resposta.

## Exemplo de implementação

```java
package com.financeai.auth;

public class RespostaRegistrarUsuario
{
    public static final String TIPO = "RespostaRegistrarUsuario";

    private String id;
    private String nome;
    private String email;

    public RespostaRegistrarUsuario (String id, String nome, String email)
    {
        this.id = id;
        this.nome = nome;
        this.email = email;
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
}
```
