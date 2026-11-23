package com.financeai.auth;
public class RespostaValidarMFA {

    public static final String TIPO = "RespostaValidarMFA";

    private boolean valido;
    private Long contador;

    public RespostaValidarMFA(boolean valido) {
        this(valido, null);
    }

    public RespostaValidarMFA(boolean valido, Long contador) {
        this.valido = valido;
        this.contador = contador;
    }

    public boolean getValido() {
        return this.valido;
    }

    public Long getContador() {
        return this.contador;
    }
}
