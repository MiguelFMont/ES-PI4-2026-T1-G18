
package com.financeai.auth;

public class RespostaValidarSenha
{
    public static final String TIPO = "RespostaValidarSenha";
    private boolean valido;
    public RespostaValidarSenha (boolean valido)
    {
        this.valido = valido;
    }
    public boolean getValido ()
    {
        return this.valido;
    }
}
