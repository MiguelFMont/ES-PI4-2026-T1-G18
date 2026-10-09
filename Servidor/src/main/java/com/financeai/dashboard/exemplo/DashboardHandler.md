# DashboardHandler.java — Handlers do Grupo 3 (Painel Financeiro)

## O que deve ter neste arquivo
- Registra `PedidoCalcularIndicadores` e `PedidoCompararPeriodos`. Em ambos o Backend agrega os valores no MongoDB e manda **só os números**; o handler faz as contas.
- `calcularIndicadores`: recebe as receitas e as despesas do mês e calcula saldo, economia e fluxo de caixa. A fórmula é decisão do grupo e fica só aqui (o exemplo usa: saldo = receitas − despesas; economia = percentual das receitas que sobrou; fluxo de caixa = saldo do período). Divisão por zero (mês sem receitas) é tratada aqui, devolvendo economia `0`.
- `compararPeriodos`: recebe os totais de vários períodos (do mais antigo ao mais recente) e devolve, para cada um, o saldo e a **variação percentual** de receitas, despesas e saldo em relação ao período anterior, mais a tendência das despesas (`alta`, `queda` ou `estavel`, usando ±5% como limite). É a conta "este mês contra o mês passado".
- Regras de cálculo da variação: `(atual − anterior) / |anterior| × 100`, arredondada em 2 casas; se o período anterior for `0` (sem base de comparação), a variação é `0`; o primeiro período não tem anterior e também devolve `0`.
- Sem acesso ao MongoDB: só calcula sobre o que veio no pedido.

## Exemplo de implementação

```java
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
    private static final double LIMITE_TENDENCIA = 5.0;   // % de variacao das despesas

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoCalcularIndicadores.TIPO, this::calcularIndicadores);
        registry.registrar (PedidoCompararPeriodos.TIPO,    this::compararPeriodos);
    }

    private Comunicado calcularIndicadores (Comunicado pedido) throws Exception
    {
        PedidoCalcularIndicadores p = pedido.dadosComo (PedidoCalcularIndicadores.class);

        double saldo    = p.getReceitas() - p.getDespesas();
        double economia = p.getReceitas() > 0 ? (saldo / p.getReceitas()) * 100 : 0;
        double fluxo    = saldo;

        return Comunicado.de (RespostaCalcularIndicadores.TIPO,
                              new RespostaCalcularIndicadores(saldo, economia, fluxo));
    }

    private Comunicado compararPeriodos (Comunicado pedido) throws Exception
    {
        PedidoCompararPeriodos p = pedido.dadosComo (PedidoCompararPeriodos.class);

        if (p.getPeriodos() == null || p.getPeriodos().isEmpty())
            throw new ErroDeNegocio ("VALIDATION", "Informe ao menos um periodo");

        List<Map<String, Object>> saida = new ArrayList<>();
        double receitasAnt = 0, despesasAnt = 0, saldoAnt = 0;
        double variacaoDespesas = 0;
        boolean primeiro = true;

        for (Map<String, Object> periodo : p.getPeriodos())
        {
            double receitas = numero (periodo, "receitas");
            double despesas = numero (periodo, "despesas");
            double saldo    = receitas - despesas;

            variacaoDespesas = primeiro ? 0 : variacao (despesasAnt, despesas);

            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put ("rotulo",           periodo.get ("rotulo"));
            linha.put ("receitas",         receitas);
            linha.put ("despesas",         despesas);
            linha.put ("saldo",            saldo);
            linha.put ("variacaoReceitas", primeiro ? 0.0 : variacao (receitasAnt, receitas));
            linha.put ("variacaoDespesas", variacaoDespesas);
            linha.put ("variacaoSaldo",    primeiro ? 0.0 : variacao (saldoAnt, saldo));
            saida.add (linha);

            receitasAnt = receitas;
            despesasAnt = despesas;
            saldoAnt    = saldo;
            primeiro    = false;
        }

        String tendencia = variacaoDespesas > LIMITE_TENDENCIA  ? "alta"
                         : variacaoDespesas < -LIMITE_TENDENCIA ? "queda"
                         : "estavel";

        return Comunicado.de (RespostaCompararPeriodos.TIPO,
                              new RespostaCompararPeriodos(saida, tendencia));
    }

    // (atual - anterior) / |anterior| * 100, sem dividir por zero
    private static double variacao (double anterior, double atual)
    {
        if (anterior == 0)
            return 0;

        return Math.round ((atual - anterior) / Math.abs(anterior) * 10000.0) / 100.0;
    }

    private static double numero (Map<String, Object> mapa, String chave)
    {
        Object valor = mapa.get (chave);
        return valor == null ? 0 : ((Number) valor).doubleValue();
    }
}
```
