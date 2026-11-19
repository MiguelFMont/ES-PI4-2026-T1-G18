package com.financeai.goals;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

// Handler do Grupo 5 (metas). Operacao pura, como todas do Servidor: tudo o que precisa vem no pedido e nada e
// gravado. O CRUD das metas e o MongoDB sao do Backend.
public class GoalsHandler
{
    private static final double DIAS_POR_MES = 30.0;

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoProgressoMeta.TIPO, this::progressoMeta);
    }

    private Comunicado progressoMeta (Comunicado pedido) throws Exception
    {
        PedidoProgressoMeta p = pedido.dadosComo (PedidoProgressoMeta.class);

        if (p.getValorObjetivo () <= 0)
            throw new ErroDeNegocio ("VALIDATION", "Valor objetivo invalido");

        LocalDate prazo = GoalsHandler.lerData (p.getPrazo (), "Prazo");
        LocalDate hoje  = p.getHoje () == null
                        ? LocalDate.now (ZoneOffset.UTC)
                        : GoalsHandler.lerData (p.getHoje (), "Data de referencia");

        // valor acumulado negativo (mais despesas que receitas) nao e progresso: conta como zero
        double atual     = Math.max (0, p.getValorAtual ());
        double objetivo  = p.getValorObjetivo ();
        boolean concluida = atual >= objetivo;

        double percentual = GoalsHandler.arredondar (Math.min (100.0, atual / objetivo * 100.0));
        double falta      = concluida ? 0 : GoalsHandler.arredondar (objetivo - atual);

        int     dias    = (int) Math.max (0, ChronoUnit.DAYS.between (hoje, prazo));
        boolean noPrazo = concluida || !prazo.isBefore (hoje);
        int     meses   = Math.max (1, (int) Math.ceil (dias / GoalsHandler.DIAS_POR_MES));
        double  aporte  = concluida ? 0 : GoalsHandler.arredondar (falta / meses);

        return Comunicado.de (RespostaProgressoMeta.TIPO,
                              new RespostaProgressoMeta (percentual, falta, concluida, noPrazo, dias, meses, aporte));
    }

    // Aceita o instante completo ("2026-12-31T00:00:00.000Z", como o Backend serializa uma Date) ou so a data.
    private static LocalDate lerData (String texto, String nome) throws ErroDeNegocio
    {
        if (texto == null || texto.isBlank ())
            throw new ErroDeNegocio ("VALIDATION", nome + " invalido");

        try
        {
            if (texto.length () > 10)
                return Instant.parse (texto).atZone (ZoneOffset.UTC).toLocalDate ();

            return LocalDate.parse (texto);
        }
        catch (DateTimeParseException erro)
        {
            throw new ErroDeNegocio ("VALIDATION", nome + " invalido");
        }
    }

    private static double arredondar (double valor)
    {
        return Math.round (valor * 100.0) / 100.0;
    }
}
