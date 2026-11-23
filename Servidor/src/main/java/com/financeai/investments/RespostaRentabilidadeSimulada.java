/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.investments;

import java.util.List;
import java.util.Map;

public class RespostaRentabilidadeSimulada
{
    public static final String TIPO = "RespostaRentabilidadeSimulada";

    // cada ativo do pedido, com valorAtual, rendimento, rentabilidade (%) e percentualCarteira (%) acrescentados
    private List < Map < String, Object > > ativos;
    private double                          totalInvestido;
    private double                          patrimonio;      // soma dos valores atuais
    private double                          rendimento;      // patrimonio - totalInvestido
    private double                          rentabilidade;   // em % sobre o total investido

    public RespostaRentabilidadeSimulada (List < Map < String, Object > > ativos, double totalInvestido,
                                          double patrimonio, double rendimento, double rentabilidade)
    {
        this.ativos         = ativos;
        this.totalInvestido = totalInvestido;
        this.patrimonio     = patrimonio;
        this.rendimento     = rendimento;
        this.rentabilidade  = rentabilidade;
    }

    public List < Map < String, Object > > getAtivos ()
    {
        return this.ativos;
    }

    public double getTotalInvestido ()
    {
        return this.totalInvestido;
    }

    public double getPatrimonio ()
    {
        return this.patrimonio;
    }

    public double getRendimento ()
    {
        return this.rendimento;
    }

    public double getRentabilidade ()
    {
        return this.rentabilidade;
    }

    public String toString ()
    {
        return (RespostaRentabilidadeSimulada.TIPO + ": patrimonio=" + this.patrimonio);
    }
}
