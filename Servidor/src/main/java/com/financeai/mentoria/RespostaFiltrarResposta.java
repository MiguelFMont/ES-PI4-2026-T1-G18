package com.financeai.mentoria;

public class RespostaFiltrarResposta
{
    public static final String TIPO = "RespostaFiltrarResposta";

    private String respostaFiltrada;

    public RespostaFiltrarResposta (String respostaFiltrada)
    {
        this.respostaFiltrada = respostaFiltrada;
    }

    public String getRespostaFiltrada ()
    {
        return this.respostaFiltrada;
    }
}
