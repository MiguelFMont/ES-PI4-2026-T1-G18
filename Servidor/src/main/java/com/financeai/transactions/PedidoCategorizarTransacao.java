/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.transactions;

public class PedidoCategorizarTransacao
{
    public static final String TIPO = "PedidoCategorizarTransacao";

    private String descricao;
    private double valor;

    public String getDescricao ()
    {
        return this.descricao;
    }

    public double getValor ()
    {
        return this.valor;
    }
}