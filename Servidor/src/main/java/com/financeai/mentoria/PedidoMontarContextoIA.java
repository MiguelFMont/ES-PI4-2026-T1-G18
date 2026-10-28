package com.financeai.mentoria;

import java.util.List;

// O Backend manda as transacoes do mes atual (ja filtradas pelo usuario) e o dia de hoje;
// o Servidor faz todas as contas, para a IA so interpretar numeros prontos.
public class PedidoMontarContextoIA
{
    public static final String TIPO = "PedidoMontarContextoIA";

    private int             diaDoMes;
    private List<Transacao> transacoes;

    public int getDiaDoMes ()
    {
        return this.diaDoMes;
    }

    public List<Transacao> getTransacoes ()
    {
        return this.transacoes;
    }

    public static class Transacao
    {
        private String tipo;      // "receita" ou "despesa"
        private double valor;     // sempre positivo
        private String categoria;
        private String descricao;
        private String data;      // ISO 8601

        public String getTipo ()
        {
            return this.tipo;
        }

        public double getValor ()
        {
            return this.valor;
        }

        public String getCategoria ()
        {
            return this.categoria;
        }

        public String getDescricao ()
        {
            return this.descricao;
        }

        public String getData ()
        {
            return this.data;
        }
    }
}
