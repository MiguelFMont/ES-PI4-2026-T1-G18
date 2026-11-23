package com.financeai.transactions;

import java.util.List;

// Resposta de PedidoCalcularSaldoContas: o saldo atual de cada conta do pedido, na mesma ordem.
public class RespostaCalcularSaldoContas
{
    public static final String TIPO = "RespostaCalcularSaldoContas";

    private List < Saldo > saldos;

    public RespostaCalcularSaldoContas (List < Saldo > saldos)
    {
        this.saldos = saldos;
    }

    public List < Saldo > getSaldos ()
    {
        return this.saldos;
    }

    public static class Saldo
    {
        private String contaId;
        private double saldoAtual;

        public Saldo (String contaId, double saldoAtual)
        {
            this.contaId    = contaId;
            this.saldoAtual = saldoAtual;
        }

        public String getContaId ()
        {
            return this.contaId;
        }

        public double getSaldoAtual ()
        {
            return this.saldoAtual;
        }
    }
}
