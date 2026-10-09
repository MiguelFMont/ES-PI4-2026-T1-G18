# Comunicado.java — Envelope-base das mensagens

## O que deve ter neste arquivo
- Equivalente ao `Comunicado.java` do professor, que era uma classe vazia `Serializable` estendida por `PedidoDeOperacao`, `Resultado` etc. Como o protocolo agora é **JSON em linhas** (o Backend é Node e não lê `ObjectOutputStream`), o `Comunicado` passa a ser o envelope `{ "tipo": "...", "dados": {...} }`.
- O `tipo` faz o papel do `instanceof` do professor: o `HandlerRegistry` procura o handler pelo `tipo`.
- Os payloads de cada feature (`PedidoHashSenha`, `RespostaHashSenha`...) são classes simples (POJOs) que **não estendem** `Comunicado`: o envelope já carrega o tipo, e o payload é convertido com `dadosComo(Classe)`.
- Concentra as três mensagens de controle do protocolo: `PedidoParaSair` (Backend → Servidor), `ComunicadoDeDesligamento` (Servidor → Backend) e `Erro`.
- **Contrato de erro:** a resposta `Erro` carrega só `{ code, message }`. O `code` é um identificador estável (`EMAIL_IN_USE`). **O Servidor não conhece HTTP**: quem traduz o `code` em status (`409`, `401`, `404`...) é o Backend, na tabela `shared/errors/error-codes.ts`. O Servidor decide *o que* aconteceu; o Backend decide *como* isso aparece no HTTP. Os handlers geram esse erro lançando `ErroDeNegocio`.
- Campos **não** são `final`: o Gson os preenche por reflexão ao ler o JSON, e o Java 26 avisa quando uma biblioteca altera campo `final`.
- Concentra a conversão de/para JSON (Gson), para nenhuma outra classe conhecer a biblioteca.

## Exemplo de implementação

```java
package com.financeai.core;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

public class Comunicado
{
    public static final String TIPO_PEDIDO_PARA_SAIR = "PedidoParaSair";
    public static final String TIPO_DESLIGAMENTO     = "ComunicadoDeDesligamento";
    public static final String TIPO_ERRO             = "Erro";

    private static final Gson GSON = new Gson();

    // nao sao final: o Gson preenche estes campos por reflexao ao ler o JSON
    private String      tipo;
    private JsonElement dados;

    public Comunicado (String tipo, JsonElement dados)
    {
        if (tipo == null || tipo.isBlank())
            throw new IllegalArgumentException ("Tipo ausente");

        this.tipo  = tipo;
        this.dados = dados == null ? new JsonObject() : dados;
    }

    public static Comunicado de (String tipo, Object payload)
    {
        return new Comunicado (tipo, GSON.toJsonTree(payload));
    }

    public static Comunicado desligamento ()
    {
        return new Comunicado (TIPO_DESLIGAMENTO, new JsonObject());
    }

    public static Comunicado erro (String code, String mensagem)
    {
        JsonObject dados = new JsonObject();
        dados.addProperty ("code",    code);
        dados.addProperty ("message", mensagem);
        return new Comunicado (TIPO_ERRO, dados);
    }

    public static Comunicado erro (String mensagem)
    {
        return erro ("INTERNAL_ERROR", mensagem);
    }

    public static Comunicado lerJson (String linha)
    {
        Comunicado comunicado = GSON.fromJson (linha, Comunicado.class);

        if (comunicado == null || comunicado.tipo == null || comunicado.tipo.isBlank())
            throw new IllegalArgumentException ("Comunicado invalido");

        if (comunicado.dados == null)
            comunicado.dados = new JsonObject();

        return comunicado;
    }

    public String paraJson ()
    {
        return GSON.toJson (this);
    }

    public <T> T dadosComo (Class<T> classe)
    {
        return GSON.fromJson (this.dados, classe);
    }

    public JsonElement getDados ()
    {
        return this.dados;
    }

    public String getTipo ()
    {
        return this.tipo;
    }
}
```
