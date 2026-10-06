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

    public static Comunicado erro (String mensagem)
    {
        JsonObject dados = new JsonObject();
        dados.addProperty ("message", mensagem);
        return new Comunicado (TIPO_ERRO, dados);
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
