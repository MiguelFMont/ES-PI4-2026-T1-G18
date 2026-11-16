package com.financeai.goals;

public class RespostaProgressoMeta
{
    public static final String TIPO = "RespostaProgressoMeta";

    private double  percentual;              // 0 a 100, com 2 casas
    private double  falta;                   // o que ainda falta para o objetivo (0 se ja foi atingido)
    private boolean concluida;               // valor atual >= objetivo
    private boolean noPrazo;                 // concluida, ou o prazo ainda nao passou
    private int     diasRestantes;           // ate o prazo (0 se ja venceu)
    private int     mesesRestantes;          // ceil(dias / 30), no minimo 1: base do aporte mensal
    private double  aporteMensalNecessario;  // falta / mesesRestantes (0 se concluida)

    public RespostaProgressoMeta (double percentual, double falta, boolean concluida, boolean noPrazo,
                                  int diasRestantes, int mesesRestantes, double aporteMensalNecessario)
    {
        this.percentual             = percentual;
        this.falta                  = falta;
        this.concluida              = concluida;
        this.noPrazo                = noPrazo;
        this.diasRestantes          = diasRestantes;
        this.mesesRestantes         = mesesRestantes;
        this.aporteMensalNecessario = aporteMensalNecessario;
    }

    public double getPercentual ()
    {
        return this.percentual;
    }

    public double getFalta ()
    {
        return this.falta;
    }

    public boolean isConcluida ()
    {
        return this.concluida;
    }

    public boolean isNoPrazo ()
    {
        return this.noPrazo;
    }

    public int getDiasRestantes ()
    {
        return this.diasRestantes;
    }

    public int getMesesRestantes ()
    {
        return this.mesesRestantes;
    }

    public double getAporteMensalNecessario ()
    {
        return this.aporteMensalNecessario;
    }

    public String toString ()
    {
        return (RespostaProgressoMeta.TIPO + ": " + this.percentual + "%");
    }
}
