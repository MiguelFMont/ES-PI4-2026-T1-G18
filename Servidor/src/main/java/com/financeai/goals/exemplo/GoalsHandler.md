# GoalsHandler.java — Handlers do Grupo 5 (Metas Financeiras)

## O que deve ter neste arquivo
- Registra `PedidoProgressoMeta`. O Backend envia o valor acumulado, o valor objetivo e o prazo da meta; o handler calcula o percentual concluído e se a meta ainda está dentro do prazo.
- A fórmula é do Java (e do grupo). O exemplo usa: percentual = acumulado ÷ objetivo, limitado a 100; "dentro do prazo" = meta já concluída ou prazo ainda no futuro.
- O prazo chega como texto ISO-8601 (como o Backend serializa uma data em JSON), por isso é convertido com `Instant.parse`.
- Valor objetivo zero ou negativo deve ser tratado (evita divisão por zero).

## Exemplo de implementação

```java
package com.financeai.goals;

import java.time.Instant;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class GoalsHandler
{
    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoProgressoMeta.TIPO, this::progressoMeta);
    }

    private Comunicado progressoMeta (Comunicado pedido) throws Exception
    {
        PedidoProgressoMeta p = pedido.dadosComo (PedidoProgressoMeta.class);

        if (p.getValorObjetivo() <= 0)
            throw new Exception ("Valor objetivo invalido");

        double percentual = Math.min (100.0, (p.getValorAtual() / p.getValorObjetivo()) * 100);
        boolean noPrazo   = percentual >= 100 || Instant.parse(p.getPrazo()).isAfter(Instant.now());

        return Comunicado.de (RespostaProgressoMeta.TIPO,
                              new RespostaProgressoMeta(percentual, noPrazo));
    }
}
```
