package com.financeai.transactions;

public class RespostaCategorizarTransacao
{
    public static final String TIPO = "RespostaCategorizarTransacao";

    private String categoria;

    public RespostaCategorizarTransacao (String categoria)
    {
        this.categoria = categoria;
    }

    public String getCategoria ()
    {
        return this.categoria;
    }
}