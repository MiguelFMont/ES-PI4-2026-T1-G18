package com.financeai.core;

// Falha de regra de negocio: o handler lanca esta excecao e a Supervisora a
// converte em uma resposta "Erro" com code e message. O status HTTP nao e daqui:
// o Backend traduz o code em status (ex.: EMAIL_IN_USE -> 409, INVALID_CREDENTIALS -> 401).
// Todo code novo precisa entrar na tabela do Backend (shared/errors/error-codes.ts).
public class ErroDeNegocio extends Exception
{
    private static final long serialVersionUID = 1L;

    private final String code;

    public ErroDeNegocio (String code, String mensagem)
    {
        super (mensagem);
        this.code   = code;
    }

    public String getCode ()
    {
        return this.code;
    }
}
