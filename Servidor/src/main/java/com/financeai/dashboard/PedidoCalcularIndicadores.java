package com.financeai.dashboard;

public class PedidoCalcularIndicadores
{
    public static final String TIPO = "PedidoCalcularIndicadores";

    private double receitas;
    private double despesas;

    public double getReceitas ()
    {
        return this.receitas;
    }

    public double getDespesas ()
    {
        return this.despesas;
    }
}