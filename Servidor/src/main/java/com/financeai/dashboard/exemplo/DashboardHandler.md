# DashboardHandler.java — Handlers do Grupo 3 (Painel Financeiro)

## O que deve ter neste arquivo
- Registra `PedidoCalcularIndicadores`. O Backend agrega as transações do mês (receitas e despesas) no MongoDB e manda só os totais; o handler calcula os indicadores do painel.
- A fórmula de cada indicador é decisão do grupo e fica só aqui (o exemplo usa: saldo = receitas − despesas; economia = percentual das receitas que sobrou; fluxo de caixa = saldo do período).
- Divisão por zero (mês sem receitas) deve ser tratada aqui, devolvendo economia `0`.

## Exemplo de implementação

```java
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
        double economia = p.getReceitas() > 0 ? (saldo / p.getReceitas()) * 100 : 0;
        double fluxo    = saldo;

        return Comunicado.de (RespostaCalcularIndicadores.TIPO,
                              new RespostaCalcularIndicadores(saldo, economia, fluxo));
    }
}
```
