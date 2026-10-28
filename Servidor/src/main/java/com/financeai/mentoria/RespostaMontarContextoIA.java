package com.financeai.mentoria;

public class RespostaMontarContextoIA
{
    public static final String TIPO = "RespostaMontarContextoIA";

    private String contexto;

    public RespostaMontarContextoIA (String contexto)
    {
        this.contexto = contexto;
    }

    public String getContexto ()
    {
        return this.contexto;
    }
}
