# InvestmentsHandler.java — Handlers do Grupo 5 (Investimentos Simulados)

## O que deve ter neste arquivo
- Registra `PedidoPainelInvestimentos` e `PedidoListarParcelamentos`.
- `painel`: lê os ativos simulados do usuário, aplica uma rentabilidade **fictícia** a cada um e devolve o patrimônio total e a lista de ativos com o campo `rentabilidade`. Tudo é simulação: nenhuma integração com mercado real. O exemplo usa uma taxa fixa; a versão real pode variar por tipo de ativo.
- `parcelamentos`: devolve os parcelamentos ativos do cartão (parcela atual/total e valor mensal).
- Só leitura, sempre do `userId` do pedido.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.bson.Document;

import com.financeai.core.Banco;
import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class InvestmentsHandler
{
    private static final double RENTABILIDADE_SIMULADA = 0.0085;   // 0,85% ao mes (ficticio)

    private final InvestmentsRepository repositorio = new InvestmentsRepository();

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoPainelInvestimentos.TIPO, this::painel);
        registry.registrar (PedidoListarParcelamentos.TIPO, this::parcelamentos);
    }

    private Comunicado painel (Comunicado pedido) throws Exception
    {
        PedidoPainelInvestimentos p = pedido.dadosComo (PedidoPainelInvestimentos.class);

        double patrimonio = 0;
        List<Map<String, Object>> ativos = new ArrayList<>();

        for (Document d : this.repositorio.ativos (p.getUserId()))
        {
            double valor = ((Number) d.get ("valor")).doubleValue();
            patrimonio  += valor * (1 + RENTABILIDADE_SIMULADA);

            Map<String, Object> ativo = Banco.paraMapa (d);
            ativo.put ("rentabilidade", RENTABILIDADE_SIMULADA);
            ativos.add (ativo);
        }

        return Comunicado.de (RespostaPainelInvestimentos.TIPO,
                              new RespostaPainelInvestimentos (patrimonio, ativos));
    }

    private Comunicado parcelamentos (Comunicado pedido) throws Exception
    {
        PedidoListarParcelamentos p = pedido.dadosComo (PedidoListarParcelamentos.class);

        List<Map<String, Object>> parcelamentos = new ArrayList<>();
        for (Document d : this.repositorio.parcelamentosAtivos (p.getUserId()))
            parcelamentos.add (Banco.paraMapa (d));

        return Comunicado.de (RespostaListarParcelamentos.TIPO, new RespostaListarParcelamentos (parcelamentos));
    }
}
```
