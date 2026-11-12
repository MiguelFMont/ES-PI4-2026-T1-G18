package com.financeai.dashboard;

public class PedidoCalcularIndicadores
{
    public static final String TIPO = "PedidoCalcularIndicadores";

    private double receitas;
    private double despesas;

    public PedidoCalcularIndicadores ()
    {}

    public PedidoCalcularIndicadores (double receitas, double despesas)
    {
        this.receitas = receitas;
        this.despesas = despesas;
    }

    public double getReceitas ()
    {
        return this.receitas;
    }

    public double getDespesas ()
    {
        return this.despesas;
    }

    public String toString ()
    {
        return (PedidoCalcularIndicadores.TIPO + ": receitas=" + this.receitas + ", despesas=" + this.despesas);
    }
}