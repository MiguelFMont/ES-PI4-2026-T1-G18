# InvestmentsHandler.java — Handlers do Grupo 5 (Investimentos Simulados e Parcelamentos)

## O que deve ter neste arquivo
- Registra `PedidoRentabilidadeSimulada` e `PedidoCalcularParcelamentos`. As duas são **contas financeiras**: o Backend lê os dados no MongoDB, manda no pedido, e grava ou devolve o resultado.
- `rentabilidadeSimulada`: o Backend envia a lista de ativos simulados do usuário (nome e valor investido) e, opcionalmente, `meses` (padrão `1`). O handler aplica **juros compostos** a cada ativo, `valor × (1 + taxa/100)^meses`, e devolve o patrimônio projetado e a lista com `taxaMensal`, `valorProjetado` e `rendimento` em cada ativo. A taxa vem do próprio ativo (`taxaMensal`, em %); se faltar, usa uma taxa fictícia padrão (0,85% ao mês). Tudo é **simulação**: nenhuma integração com mercado real.
- `calcularParcelamentos`: o Backend envia uma lista de parcelamentos (`valorTotal`, `parcelas`, `parcelasPagas` e `taxaJurosMensal` em %; qualquer outro campo, como `id` e `descricao`, volta igual). Para cada um, o handler calcula pela **Tabela Price** (parcelas iguais): `valorParcela = valorTotal × i / (1 − (1+i)^−n)`, com `i = taxa/100`; sem juros (`taxa = 0`) é `valorTotal / n`. Devolve também `totalPago`, `totalJuros`, `parcelasRestantes` e o `saldoDevedor` depois das parcelas já pagas. Serve tanto para exibir os parcelamentos ativos do cartão quanto para simular um parcelamento novo (`parcelasPagas = 0`).
- Valores inválidos (total ou parcelas menores que 1, taxa negativa, mais parcelas pagas do que parcelas) viram `ErroDeNegocio("VALIDATION", ...)`.
- Sem acesso ao MongoDB: só calcula sobre o que veio no pedido. Os ativos viajam como `List<Map<String,Object>>`.

## Exemplo de implementação

```java
package com.financeai.investments;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

public class InvestmentsHandler
{
    private static final double TAXA_PADRAO_MENSAL = 0.85;   // % ao mes (ficticia)

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoRentabilidadeSimulada.TIPO, this::rentabilidadeSimulada);
        registry.registrar (PedidoCalcularParcelamentos.TIPO, this::calcularParcelamentos);
    }

    private Comunicado rentabilidadeSimulada (Comunicado pedido) throws Exception
    {
        PedidoRentabilidadeSimulada p = pedido.dadosComo (PedidoRentabilidadeSimulada.class);

        if (p.getAtivos() == null)
            throw new ErroDeNegocio ("VALIDATION", "Lista de ativos ausente");

        int meses = p.getMeses() == null ? 1 : p.getMeses();
        if (meses < 1 || meses > 600)
            throw new ErroDeNegocio ("VALIDATION", "Meses invalido");

        double patrimonio = 0;
        List<Map<String, Object>> resultado = new ArrayList<>();

        for (Map<String, Object> ativo : p.getAtivos())
        {
            double valor     = numero (ativo, "valor");
            double taxa      = ativo.containsKey("taxaMensal") ? numero (ativo, "taxaMensal") : TAXA_PADRAO_MENSAL;
            double projetado = valor * Math.pow (1 + taxa / 100.0, meses);   // juros compostos

            patrimonio += projetado;

            Map<String, Object> saida = new LinkedHashMap<>(ativo);
            saida.put ("taxaMensal",     taxa);
            saida.put ("valorProjetado", arredondar (projetado));
            saida.put ("rendimento",     arredondar (projetado - valor));
            resultado.add (saida);
        }

        return Comunicado.de (RespostaRentabilidadeSimulada.TIPO,
                              new RespostaRentabilidadeSimulada(arredondar (patrimonio), resultado));
    }

    private Comunicado calcularParcelamentos (Comunicado pedido) throws Exception
    {
        PedidoCalcularParcelamentos p = pedido.dadosComo (PedidoCalcularParcelamentos.class);

        if (p.getParcelamentos() == null)
            throw new ErroDeNegocio ("VALIDATION", "Lista de parcelamentos ausente");

        List<Map<String, Object>> resultado = new ArrayList<>();

        for (Map<String, Object> item : p.getParcelamentos())
        {
            double total = numero (item, "valorTotal");
            int    n     = (int) numero (item, "parcelas");
            int    pagas = (int) numero (item, "parcelasPagas");
            double i     = numero (item, "taxaJurosMensal") / 100.0;

            if (total <= 0 || n < 1 || pagas < 0 || pagas > n || i < 0)
                throw new ErroDeNegocio ("VALIDATION", "Parcelamento invalido");

            double parcela = i == 0 ? total / n : total * i / (1 - Math.pow (1 + i, -n));    // Tabela Price
            double fator   = Math.pow (1 + i, pagas);
            double saldo   = i == 0 ? total - parcela * pagas
                                    : total * fator - parcela * (fator - 1) / i;
            double pago    = parcela * n;

            Map<String, Object> saida = new LinkedHashMap<>(item);
            saida.put ("valorParcela",     arredondar (parcela));
            saida.put ("totalPago",        arredondar (pago));
            saida.put ("totalJuros",       arredondar (pago - total));
            saida.put ("parcelasRestantes", n - pagas);
            saida.put ("saldoDevedor",     arredondar (Math.max (0, saldo)));
            resultado.add (saida);
        }

        return Comunicado.de (RespostaCalcularParcelamentos.TIPO,
                              new RespostaCalcularParcelamentos(resultado));
    }

    private static double numero (Map<String, Object> mapa, String chave)
    {
        Object valor = mapa.get (chave);
        return valor == null ? 0 : ((Number) valor).doubleValue();
    }

    private static double arredondar (double valor)
    {
        return Math.round (valor * 100.0) / 100.0;
    }
}
```
