
package com.financeai.auth;

public class RespostaGerarSegredoMFA {

    public static final String TIPO = "RespostaGerarSegredoMFA";

    private String segredo;
    private String uri;

    public RespostaGerarSegredoMFA(String segredo, String uri) {
        this.segredo = segredo;
        this.uri = uri;
    }

    public String getSegredo() {
        return this.segredo;
    }

    public String getUri() {
        return this.uri;
    }
}
