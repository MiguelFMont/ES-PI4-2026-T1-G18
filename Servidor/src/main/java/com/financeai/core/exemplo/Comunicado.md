# Comunicado.java — Envelope-base das mensagens

## O que deve ter neste arquivo
- Equivalente ao `Comunicado.java` do professor, que era uma classe vazia `Serializable` estendida por `PedidoDeOperacao`, `Resultado` etc. Como o protocolo agora é **JSON em linhas** (o Backend é Node e não lê `ObjectOutputStream`), o `Comunicado` passa a ser o envelope `{ "tipo": "...", "dados": {...} }`.
- O `tipo` faz o papel do `instanceof` do professor: o `HandlerRegistry` procura o handler pelo `tipo`.
- Os payloads de cada feature (`PedidoHashSenha`, `RespostaHashSenha`...) são classes simples (POJOs) que **não estendem** `Comunicado`: o envelope já carrega o tipo, e o payload é convertido com `dadosComo(Classe)`.
- Concentra as três mensagens de controle do protocolo: `PedidoParaSair` (Backend → Servidor), `ComunicadoDeDesligamento` (Servidor → Backend) e `Erro` (resposta quando um handler falha ou o `tipo` é desconhecido).
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

    private final String      tipo;
    private final JsonElement dados;

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

    public static Comunicado erro (String mensagem)
    {
        JsonObject dados = new JsonObject();
        dados.addProperty ("message", mensagem);
        return new Comunicado (TIPO_ERRO, dados);
    }

    public static Comunicado lerJson (String linha)
    {
        return GSON.fromJson (linha, Comunicado.class);
    }

    public String paraJson ()
    {
        return GSON.toJson (this);
    }

    public <T> T dadosComo (Class<T> classe)
    {
        return GSON.fromJson (this.dados, classe);
    }

    public String getTipo ()
    {
        return this.tipo;
    }
}
```
