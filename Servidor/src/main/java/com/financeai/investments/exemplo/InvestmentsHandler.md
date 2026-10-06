# InvestmentsHandler.java — Handlers do Grupo 5 (Investimentos Simulados)

## O que deve ter neste arquivo
- Registra `PedidoRentabilidadeSimulada`. O Backend envia a lista de ativos simulados do usuário (nome e valor investido); o handler aplica uma rentabilidade fictícia a cada um e devolve o patrimônio total.
- Tudo é **simulação**: nenhuma integração com mercado real. O exemplo usa uma taxa fixa por ativo; a versão real pode sortear uma variação ou usar uma tabela por tipo de ativo.
- Os ativos viajam como `List<Map<String,Object>>` (nome, valor); a resposta devolve a mesma lista com o campo `rentabilidade` acrescentado.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class InvestmentsHandler
{
    private static final double RENTABILIDADE_SIMULADA = 0.0085;   // 0,85% ao mes (fictício)

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoRentabilidadeSimulada.TIPO, this::rentabilidadeSimulada);
    }

    private Comunicado rentabilidadeSimulada (Comunicado pedido) throws Exception
    {
        PedidoRentabilidadeSimulada p = pedido.dadosComo (PedidoRentabilidadeSimulada.class);

        double patrimonio = 0;
        List<Map<String, Object>> resultado = new ArrayList<>();

        for (Map<String, Object> ativo : p.getAtivos())
        {
            double valor = ((Number) ativo.get("valor")).doubleValue();
            double rendido = valor * (1 + RENTABILIDADE_SIMULADA);
            patrimonio += rendido;

            Map<String, Object> saida = new HashMap<>(ativo);
            saida.put ("rentabilidade", RENTABILIDADE_SIMULADA);
            resultado.add (saida);
        }

        return Comunicado.de (RespostaRentabilidadeSimulada.TIPO,
                              new RespostaRentabilidadeSimulada(patrimonio, resultado));
    }
}
```
