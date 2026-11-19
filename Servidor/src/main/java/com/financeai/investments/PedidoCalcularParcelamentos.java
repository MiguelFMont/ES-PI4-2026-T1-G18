package com.financeai.investments;

import java.util.List;
import java.util.Map;

// Pedido de calculo de parcelamentos do cartao simulado (Grupo 5). `parcelamentos`: mapas com `valorTotal` (valor
// financiado), `parcelas` (quantidade total), `parcelasPagas` (0 numa simulacao) e `taxaJurosMensal` (em %, 0 se nao ha
// juros). Qualquer outro campo (id, descricao...) volta igual na resposta.
public class PedidoCalcularParcelamentos
{
    public static final String TIPO = "PedidoCalcularParcelamentos";

    private List < Map < String, Object > > parcelamentos;

    public PedidoCalcularParcelamentos ()
    {}

    public List < Map < String, Object > > getParcelamentos ()
    {
        return this.parcelamentos;
    }

    public String toString ()
    {
        return (PedidoCalcularParcelamentos.TIPO + ": " + (this.parcelamentos == null ? 0 : this.parcelamentos.size ()) + " parcelamentos");
    }
}
