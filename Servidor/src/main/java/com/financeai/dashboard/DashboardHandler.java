package com.financeai.dashboard;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

public class DashboardHandler
{
    private static final double LIMITE_TENDENCIA = 5.0;

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoCalcularIndicadores.TIPO, this::calcularIndicadores);
        registry.registrar (PedidoCompararPeriodos.TIPO,    this::compararPeriodos);
    }

    private Comunicado calcularIndicadores (Comunicado pedido) throws Exception
    {
        PedidoCalcularIndicadores p = pedido.dadosComo (PedidoCalcularIndicadores.class);

        double saldo    = p.getReceitas () - p.getDespesas ();
        double economia = p.getReceitas () > 0
                        ? Math.round ((saldo / p.getReceitas ()) * 10000.0) / 100.0
                        : 0;
        double fluxo    = saldo;

        return Comunicado.de (RespostaCalcularIndicadores.TIPO, new RespostaCalcularIndicadores (saldo, economia, fluxo));
    }

    private Comunicado compararPeriodos (Comunicado pedido) throws Exception
    {
        PedidoCompararPeriodos p = pedido.dadosComo (PedidoCompararPeriodos.class);

        if (p.getPeriodos () == null || p.getPeriodos ().isEmpty ())
            throw new ErroDeNegocio ("VALIDATION", "Informe ao menos um periodo");

        List < Map < String, Object > > saida = new ArrayList <> ();
        double  receitasAnt      = 0,
                despesasAnt      = 0,
                saldoAnt         = 0,
                variacaoDespesas = 0;
        boolean primeiro         = true;

        for (Map < String, Object > periodo : p.getPeriodos ())
        {
            double receitas = DashboardHandler.numero (periodo, "receitas");
            double despesas = DashboardHandler.numero (periodo, "despesas");
            double saldo    = receitas - despesas;

            variacaoDespesas = primeiro ? 0 : DashboardHandler.variacao (despesasAnt, despesas);

            Map < String, Object > linha = new LinkedHashMap <> ();
            linha.put ("rotulo",           periodo.get ("rotulo"));
            linha.put ("receitas",         receitas);
            linha.put ("despesas",         despesas);
            linha.put ("saldo",            saldo);
            linha.put ("variacaoReceitas", primeiro ? 0.0 : DashboardHandler.variacao (receitasAnt, receitas));
            linha.put ("variacaoDespesas", variacaoDespesas);
            linha.put ("variacaoSaldo",    primeiro ? 0.0 : DashboardHandler.variacao (saldoAnt, saldo));
            saida.add (linha);

            receitasAnt = receitas;
            despesasAnt = despesas;
            saldoAnt    = saldo;
            primeiro    = false;
        }

        String tendencia = variacaoDespesas >  LIMITE_TENDENCIA ? "alta"
                         : variacaoDespesas < -LIMITE_TENDENCIA ? "queda"
                         : "estavel";

        return Comunicado.de (RespostaCompararPeriodos.TIPO,
                              new RespostaCompararPeriodos (saida, tendencia));
    }

    private static double variacao (double anterior, double atual)
    {
        if (anterior == 0)
            return 0;

        return Math.round ((atual - anterior) / Math.abs (anterior) * 10000.0) / 100.0;
    }

    private static double numero (Map < String, Object > mapa, String chave)
    {
        Object valor = mapa.get (chave);
        return valor == null ? 0 : ((Number) valor).doubleValue ();
    }
}