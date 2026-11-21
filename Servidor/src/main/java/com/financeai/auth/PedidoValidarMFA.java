package com.financeai.auth;

public class PedidoValidarMFA {

    public static final String TIPO = "PedidoValidarMFA";

    private String segredo;
    private String codigo;

    public String getSegredo() {
        return this.segredo;
    }

    public String getCodigo() {
        return this.codigo;
    }
}
