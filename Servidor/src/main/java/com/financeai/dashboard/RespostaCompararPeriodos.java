package com.financeai.dashboard;

import java.util.List;
import java.util.Map;

public class RespostaCompararPeriodos
{
    public static final String TIPO = "RespostaCompararPeriodos";

    private List < Map < String, Object > > periodos;
    private String                          tendenciaDespesas;

    public RespostaCompararPeriodos (List < Map < String, Object > > periodos, String tendenciaDespesas)
    {
        this.periodos          = periodos;
        this.tendenciaDespesas = tendenciaDespesas;
    }

    public List < Map < String, Object > > getPeriodos ()
    {
        return this.periodos;
    }

    public String getTendenciaDespesas ()
    {
        return this.tendenciaDespesas;
    }

    public String toString ()
    {
        return (RespostaCompararPeriodos.TIPO + ": " + this.tendenciaDespesas);
    }
}