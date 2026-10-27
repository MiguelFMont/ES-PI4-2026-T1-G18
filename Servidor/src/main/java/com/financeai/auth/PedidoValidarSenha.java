package com.financeai.auth;

public class PedidoValidarSenha {
    public static final String TIPO = "PedidoValidarSenha";
    private String senha;
    private String hash;

    public String getSenha(){
        return this.senha;
    }
    public String getHash(){
        return this.hash;
    }   
}
