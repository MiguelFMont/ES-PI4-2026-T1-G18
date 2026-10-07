# DashboardHandler.java — Handlers do Grupo 3 (Painel Financeiro)

## O que deve ter neste arquivo
- Registra `PedidoResumoPainel`, `PedidoGastosPorCategoria` e `PedidoCompararPeriodos`. São consultas **somente de leitura**: o handler lê pelo `DashboardRepository`, calcula e devolve; não grava nada.
- `PedidoResumoPainel`: soma as receitas e as despesas do mês corrente e calcula os indicadores: saldo = receitas − despesas; economia = percentual das receitas que sobrou; fluxo de caixa = saldo do período. Mês sem receitas devolve economia `0` (sem dividir por zero).
- `PedidoGastosPorCategoria`: devolve `[{ categoria, total }]`, do maior para o menor.
- `PedidoCompararPeriodos`: `periodo` pode ser `mensal` (mês corrente), `ultimos-6-meses` ou `ytd` (desde 1º de janeiro); devolve `[{ ano, mes, total }]` em ordem cronológica. Período desconhecido: `400 VALIDATION`.
- A fórmula de cada indicador é decisão do grupo e fica só aqui; o Backend apenas repassa.

## Exemplo de implementação

```java
package com.financeai.dashboard;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.bson.Document;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

public class DashboardHandler
{
    private final DashboardRepository repositorio = new DashboardRepository();

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoResumoPainel.TIPO,        this::resumo);
        registry.registrar (PedidoGastosPorCategoria.TIPO,  this::gastosPorCategoria);
        registry.registrar (PedidoCompararPeriodos.TIPO,    this::compararPeriodos);
    }

    private Comunicado resumo (Comunicado pedido) throws Exception
    {
        PedidoResumoPainel p = pedido.dadosComo (PedidoResumoPainel.class);

        double receitas = 0, despesas = 0;
        for (Document total : this.repositorio.totaisPorTipo (p.getUserId(), inicio(LocalDate.now().withDayOfMonth(1))))
        {
            double valor = ((Number) total.get ("total")).doubleValue();
            if ("receita".equals (total.getString ("_id"))) receitas = valor;
            else                                            despesas = valor;
        }

        double saldo    = receitas - despesas;
        double economia = receitas > 0 ? (saldo / receitas) * 100 : 0;

        return Comunicado.de (RespostaResumoPainel.TIPO,
            new RespostaResumoPainel (receitas, despesas, saldo, economia, saldo));
    }

    private Comunicado gastosPorCategoria (Comunicado pedido) throws Exception
    {
        PedidoGastosPorCategoria p = pedido.dadosComo (PedidoGastosPorCategoria.class);

        List<Map<String, Object>> categorias = new ArrayList<>();
        for (Document total : this.repositorio.gastosPorCategoria (p.getUserId()))
        {
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put ("categoria", total.getString ("_id"));
            linha.put ("total",     total.get ("total"));
            categorias.add (linha);
        }

        return Comunicado.de (RespostaGastosPorCategoria.TIPO, new RespostaGastosPorCategoria (categorias));
    }

    private Comunicado compararPeriodos (Comunicado pedido) throws Exception
    {
        PedidoCompararPeriodos p = pedido.dadosComo (PedidoCompararPeriodos.class);

        LocalDate hoje  = LocalDate.now();
        LocalDate desde;
        switch (p.getPeriodo() == null ? "mensal" : p.getPeriodo())
        {
            case "mensal":          desde = hoje.withDayOfMonth (1);                    break;
            case "ultimos-6-meses": desde = hoje.minusMonths(5).withDayOfMonth (1);     break;
            case "ytd":             desde = hoje.withDayOfYear (1);                     break;
            default: throw new ErroDeNegocio ("VALIDATION", "Periodo invalido: " + p.getPeriodo());
        }

        List<Map<String, Object>> periodos = new ArrayList<>();
        for (Document total : this.repositorio.totaisPorMes (p.getUserId(), inicio(desde)))
        {
            Document chave = (Document) total.get ("_id");
            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put ("ano",   chave.get ("ano"));
            linha.put ("mes",   chave.get ("mes"));
            linha.put ("total", total.get ("total"));
            periodos.add (linha);
        }

        return Comunicado.de (RespostaCompararPeriodos.TIPO, new RespostaCompararPeriodos (periodos));
    }

    private static Date inicio (LocalDate dia)
    {
        return Date.from (dia.atStartOfDay().toInstant (ZoneOffset.UTC));
    }
}
```
