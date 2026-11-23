/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class RespostaCalcularParcelamentos
{
    public static final String TIPO = "RespostaCalcularParcelamentos";

    // cada parcelamento do pedido, com valorParcela, parcelasRestantes, saldoDevedor, jurosTotal e quitado acrescentados
    private List < Map < String, Object > > parcelamentos;
    private double                          totalParcelasDoMes;   // soma das parcelas dos parcelamentos ainda ativos
    private double                          totalSaldoDevedor;
    private double                          totalJuros;           // juros dos parcelamentos ainda ativos

    public RespostaCalcularParcelamentos (List < Map < String, Object > > parcelamentos, double totalParcelasDoMes,
                                          double totalSaldoDevedor, double totalJuros)
    {
        this.parcelamentos      = parcelamentos;
        this.totalParcelasDoMes = totalParcelasDoMes;
        this.totalSaldoDevedor  = totalSaldoDevedor;
        this.totalJuros         = totalJuros;
    }

    public List < Map < String, Object > > getParcelamentos ()
    {
        return this.parcelamentos;
    }

    public double getTotalParcelasDoMes ()
    {
        return this.totalParcelasDoMes;
    }

    public double getTotalSaldoDevedor ()
    {
        return this.totalSaldoDevedor;
    }

    public double getTotalJuros ()
    {
        return this.totalJuros;
    }

    public String toString ()
    {
        return (RespostaCalcularParcelamentos.TIPO + ": saldoDevedor=" + this.totalSaldoDevedor);
    }
}
