package com.financeai.dashboard;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class DashboardHandler
{
    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoCalcularIndicadores.TIPO, this::calcularIndicadores);
    }

    private Comunicado calcularIndicadores (Comunicado pedido) throws Exception
    {
        PedidoCalcularIndicadores p = pedido.dadosComo (PedidoCalcularIndicadores.class);

        double saldo    = p.getReceitas() - p.getDespesas();
        double economia = p.getReceitas() > 0 
                        ? Math.round((saldo / p.getReceitas()) * 10000.0) / 100.0 
                        : 0;
        double fluxo    = saldo;

        return Comunicado.de (RespostaCalcularIndicadores.TIPO,
                                new RespostaCalcularIndicadores(saldo, economia, fluxo));
    }
}