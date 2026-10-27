package com.financeai.auth;

public class RespostaHashSenha {
    public static final String TIPO = "RespostaHashSenha";
    private String hash;
    public RespostaHashSenha (String hash){
        this.hash=hash;
    }
    public String getHash(){
        return this.hash;
    }
}
