package com.financeai.dashboard;

public class RespostaCalcularIndicadores
{
    public static final String TIPO = "RespostaCalcularIndicadores";

    private double saldo;
    private double economia;
    private double fluxoDeCaixa;

    public RespostaCalcularIndicadores (double saldo, double economia, double fluxoDeCaixa)
    {
        this.saldo = saldo;
        this.economia = economia;
        this.fluxoDeCaixa = fluxoDeCaixa;
    }

    public double getSaldo ()
    {
        return this.saldo;
    }

    public double getEconomia ()
    {
        return this.economia;
    }

    public double getFluxoDeCaixa ()
    {
        return this.fluxoDeCaixa;
    }
}