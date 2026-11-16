package com.financeai.investments;

import java.util.List;
import java.util.Map;

// Pedido de rentabilidade simulada (Grupo 5): juros compostos sobre os ativos do portfolio simulado.
// `ativos`: mapas com `valor` (valor investido, obrigatorio), `taxaMensal` (em %, padrao 0) e, opcionalmente, `meses`
// (quantos meses aquele ativo rendeu; sem ele vale o `meses` do pedido). Qualquer outro campo (id, nome, tipo...) volta
// igual na resposta, para o Backend associar cada resultado ao seu ativo.
public class PedidoRentabilidadeSimulada
{
    public static final String TIPO = "PedidoRentabilidadeSimulada";

    private List < Map < String, Object > > ativos;
    private Integer                         meses;   // Integer para distinguir "nao enviado" (null) de zero; padrao 1

    public PedidoRentabilidadeSimulada ()
    {}

    public List < Map < String, Object > > getAtivos ()
    {
        return this.ativos;
    }

    public Integer getMeses ()
    {
        return this.meses;
    }

    public String toString ()
    {
        return (PedidoRentabilidadeSimulada.TIPO + ": " + (this.ativos == null ? 0 : this.ativos.size ()) + " ativos");
    }
}
