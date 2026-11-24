/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.investments;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

// Handlers do Grupo 5 (investimentos e cartao simulados). Operacoes puras: os dados vem no pedido e nada e gravado.
// O portfolio, o cartao e o MongoDB sao do Backend; aqui ficam so os calculos financeiros.
public class InvestmentsHandler
{
    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoRentabilidadeSimulada.TIPO, this::rentabilidadeSimulada);
        registry.registrar (PedidoCalcularParcelamentos.TIPO, this::calcularParcelamentos);
    }

    // Juros compostos: valorAtual = valor * (1 + taxaMensal/100) ^ meses, para cada ativo, e a participacao de cada
    // um no patrimonio total (percentualCarteira).
    private Comunicado rentabilidadeSimulada (Comunicado pedido) throws Exception
    {
        PedidoRentabilidadeSimulada p = pedido.dadosComo (PedidoRentabilidadeSimulada.class);

        int mesesPadrao = p.getMeses () == null ? 1 : p.getMeses ();
        if (mesesPadrao < 0)
            throw new ErroDeNegocio ("VALIDATION", "Meses invalido");

        List < Map < String, Object > > entrada = p.getAtivos () == null ? new ArrayList <> () : p.getAtivos ();
        List < Map < String, Object > > saida   = new ArrayList <> ();
        List < Double >                 atuais  = new ArrayList <> ();
        double                          totalInvestido = 0,
                                        patrimonio     = 0;

        for (Map < String, Object > ativo : entrada)
        {
            double valor = InvestmentsHandler.numero (ativo, "valor", 0);
            double taxa  = InvestmentsHandler.numero (ativo, "taxaMensal", 0);
            int    meses = ativo.get ("meses") == null ? mesesPadrao : InvestmentsHandler.inteiro (ativo, "meses", 0);

            if (valor <= 0)
                throw new ErroDeNegocio ("VALIDATION", "Valor investido invalido");
            if (taxa <= -100)
                throw new ErroDeNegocio ("VALIDATION", "Taxa mensal invalida");
            if (meses < 0)
                throw new ErroDeNegocio ("VALIDATION", "Meses invalido");

            double atual = valor * Math.pow (1 + taxa / 100.0, meses);

            Map < String, Object > linha = new LinkedHashMap <> (ativo);
            linha.put ("valorAtual",    InvestmentsHandler.arredondar (atual));
            linha.put ("rendimento",    InvestmentsHandler.arredondar (atual - valor));
            linha.put ("rentabilidade", InvestmentsHandler.arredondar ((atual / valor - 1) * 100.0));
            saida.add (linha);

            atuais.add (atual);
            totalInvestido += valor;
            patrimonio     += atual;
        }

        for (int i = 0; i < saida.size (); i++)
            saida.get (i).put ("percentualCarteira",
                               patrimonio > 0 ? InvestmentsHandler.arredondar (atuais.get (i) / patrimonio * 100.0) : 0.0);

        double rendimento    = patrimonio - totalInvestido;
        double rentabilidade = totalInvestido > 0 ? rendimento / totalInvestido * 100.0 : 0;

        return Comunicado.de (RespostaRentabilidadeSimulada.TIPO,
                              new RespostaRentabilidadeSimulada (saida,
                                                                 InvestmentsHandler.arredondar (totalInvestido),
                                                                 InvestmentsHandler.arredondar (patrimonio),
                                                                 InvestmentsHandler.arredondar (rendimento),
                                                                 InvestmentsHandler.arredondar (rentabilidade)));
    }

    // Tabela Price: parcela = total * i / (1 - (1+i)^-n); sem juros, total / n. O saldo devedor e o valor presente das
    // parcelas que faltam (o que seria preciso pagar hoje para quitar).
    private Comunicado calcularParcelamentos (Comunicado pedido) throws Exception
    {
        PedidoCalcularParcelamentos p = pedido.dadosComo (PedidoCalcularParcelamentos.class);

        List < Map < String, Object > > entrada = p.getParcelamentos () == null ? new ArrayList <> () : p.getParcelamentos ();
        List < Map < String, Object > > saida   = new ArrayList <> ();
        double                          totalParcelas = 0,
                                        totalSaldo    = 0,
                                        totalJuros    = 0;

        for (Map < String, Object > parcelamento : entrada)
        {
            double valorTotal = InvestmentsHandler.numero (parcelamento, "valorTotal", 0);
            int    parcelas   = InvestmentsHandler.inteiro (parcelamento, "parcelas", 0);
            int    pagas      = InvestmentsHandler.inteiro (parcelamento, "parcelasPagas", 0);
            double taxa       = InvestmentsHandler.numero (parcelamento, "taxaJurosMensal", 0);

            if (valorTotal <= 0)
                throw new ErroDeNegocio ("VALIDATION", "Valor total invalido");
            if (parcelas < 1)
                throw new ErroDeNegocio ("VALIDATION", "Quantidade de parcelas invalida");
            if (pagas < 0 || pagas > parcelas)
                throw new ErroDeNegocio ("VALIDATION", "Parcelas pagas invalidas");
            if (taxa < 0)
                throw new ErroDeNegocio ("VALIDATION", "Taxa de juros invalida");

            double i          = taxa / 100.0;
            double parcela    = i == 0 ? valorTotal / parcelas : valorTotal * i / (1 - Math.pow (1 + i, -parcelas));
            int    restantes  = parcelas - pagas;
            double saldo      = restantes == 0 ? 0
                              : i == 0 ? parcela * restantes
                              : parcela * (1 - Math.pow (1 + i, -restantes)) / i;
            double juros      = parcela * parcelas - valorTotal;
            boolean quitado   = restantes == 0;

            Map < String, Object > linha = new LinkedHashMap <> (parcelamento);
            linha.put ("valorParcela",     InvestmentsHandler.arredondar (parcela));
            linha.put ("parcelasRestantes", restantes);
            linha.put ("saldoDevedor",     InvestmentsHandler.arredondar (saldo));
            linha.put ("jurosTotal",       InvestmentsHandler.arredondar (Math.max (0, juros)));
            linha.put ("quitado",          quitado);
            saida.add (linha);

            if (!quitado)
            {
                totalParcelas += parcela;
                totalSaldo    += saldo;
                totalJuros    += Math.max (0, juros);
            }
        }

        return Comunicado.de (RespostaCalcularParcelamentos.TIPO,
                              new RespostaCalcularParcelamentos (saida,
                                                                 InvestmentsHandler.arredondar (totalParcelas),
                                                                 InvestmentsHandler.arredondar (totalSaldo),
                                                                 InvestmentsHandler.arredondar (totalJuros)));
    }

    private static double numero (Map < String, Object > mapa, String chave, double padrao) throws ErroDeNegocio
    {
        Object valor = mapa.get (chave);

        if (valor == null)
            return padrao;
        if (!(valor instanceof Number))
            throw new ErroDeNegocio ("VALIDATION", "Campo invalido: " + chave);

        return ((Number) valor).doubleValue ();
    }

    private static int inteiro (Map < String, Object > mapa, String chave, int padrao) throws ErroDeNegocio
    {
        double valor = InvestmentsHandler.numero (mapa, chave, padrao);

        if (valor != Math.rint (valor))
            throw new ErroDeNegocio ("VALIDATION", "Campo invalido: " + chave);

        return (int) valor;
    }

    private static double arredondar (double valor)
    {
        return Math.round (valor * 100.0) / 100.0;
    }
}
