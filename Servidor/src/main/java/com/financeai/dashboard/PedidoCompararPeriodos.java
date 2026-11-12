package com.financeai.dashboard;

import java.util.List;
import java.util.Map;

public class PedidoCompararPeriodos
{
    public static final String TIPO = "PedidoCompararPeriodos";

    private List < Map < String, Object > > periodos;

    public PedidoCompararPeriodos ()
    {}

    public PedidoCompararPeriodos (List < Map < String, Object > > periodos)
    {
        this.periodos = periodos;
    }

    public List < Map < String, Object > > getPeriodos ()
    {
        return this.periodos;
    }

    public String toString ()
    {
        return (PedidoCompararPeriodos.TIPO + ": " + this.periodos);
    }
}