/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.transactions;

import java.util.List;

// Pedido do saldo atual de cada conta (issue #106). O Backend le as contas e os movimentos no MongoDB e manda tudo aqui:
// o Servidor nao acessa o banco. Cada movimento e uma receita, uma despesa ou uma transferencia entre duas contas.
public class PedidoCalcularSaldoContas
{
    public static final String TIPO = "PedidoCalcularSaldoContas";

    private List < Conta >      contas;
    private List < Movimento >  movimentos;

    public PedidoCalcularSaldoContas ()
    {}

    public List < Conta > getContas ()
    {
        return this.contas;
    }

    public List < Movimento > getMovimentos ()
    {
        return this.movimentos;
    }

    public String toString ()
    {
        return (PedidoCalcularSaldoContas.TIPO + ": " + this.contas + " / " + this.movimentos);
    }

    public static class Conta
    {
        private String id;
        private double saldoInicial;

        public String getId ()
        {
            return this.id;
        }

        public double getSaldoInicial ()
        {
            return this.saldoInicial;
        }
    }

    // tipo: "receita", "despesa" ou "transferencia". Na transferencia, contaId e a conta de origem e contaDestinoId a de destino.
    public static class Movimento
    {
        private String tipo;
        private double valor;
        private String contaId;
        private String contaDestinoId;

        public String getTipo ()
        {
            return this.tipo;
        }

        public double getValor ()
        {
            return this.valor;
        }

        public String getContaId ()
        {
            return this.contaId;
        }

        public String getContaDestinoId ()
        {
            return this.contaDestinoId;
        }
    }
}
