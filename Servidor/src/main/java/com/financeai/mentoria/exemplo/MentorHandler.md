# MentorHandler.java — Handlers do Grupo 4 (Mentor Financeiro com IA)

## O que deve ter neste arquivo
- Registra `PedidoMontarContextoIA` e `PedidoFiltrarResposta`. A chamada à API de IA generativa **não** acontece aqui: ela é feita pelo Backend, entre os dois pedidos (contexto → IA → filtro).
- `montarContexto`: transforma os dados financeiros que o Backend enviou (totais e transações recentes) num texto resumido, pronto para virar o contexto do prompt. O Java não acessa o MongoDB, então o Backend precisa mandar esses dados no pedido.
- `filtrarResposta`: garante a restrição do grupo, **nunca recomendar compra/venda de um ativo específico**, sem depender só do prompt. O exemplo troca por um aviso qualquer resposta que combine verbo de compra/venda com código de ativo (ex.: `PETR4`) ou nome de criptomoeda; a versão real pode ser mais completa.
- A filtragem fica no Java de propósito: é a regra de segurança do grupo e não deve ser contornável por uma mudança de prompt.

## Exemplo de implementação

```java
package com.financeai.mentoria;

import java.util.Map;
import java.util.regex.Pattern;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class MentorHandler
{
    private static final Pattern RECOMENDACAO = Pattern.compile (
        "(?i)(compr(e|ar)|vend(a|er)|aport(e|ar)).*(\\b[A-Z]{4}\\d{1,2}\\b|bitcoin|ethereum)");

    private static final String AVISO =
        "Nao posso recomendar a compra ou venda de ativos especificos. "
      + "Posso ajudar a entender seu perfil e seus gastos.";

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoMontarContextoIA.TIPO, this::montarContexto);
        registry.registrar (PedidoFiltrarResposta.TIPO,  this::filtrarResposta);
    }

    private Comunicado montarContexto (Comunicado pedido) throws Exception
    {
        PedidoMontarContextoIA p = pedido.dadosComo (PedidoMontarContextoIA.class);

        StringBuilder contexto = new StringBuilder();
        contexto.append (String.format ("Receitas do mes: R$ %.2f. ", p.getReceitas()));
        contexto.append (String.format ("Despesas do mes: R$ %.2f. ", p.getDespesas()));
        contexto.append ("Ultimas transacoes: ");

        for (Map<String, Object> t : p.getTransacoesRecentes())
            contexto.append (t.get("descricao")).append (" (").append (t.get("valor")).append ("); ");

        return Comunicado.de (RespostaMontarContextoIA.TIPO,
                              new RespostaMontarContextoIA(contexto.toString()));
    }

    private Comunicado filtrarResposta (Comunicado pedido) throws Exception
    {
        PedidoFiltrarResposta p = pedido.dadosComo (PedidoFiltrarResposta.class);

        String resposta = RECOMENDACAO.matcher(p.getResposta()).find() ? AVISO : p.getResposta();

        return Comunicado.de (RespostaFiltrarResposta.TIPO, new RespostaFiltrarResposta(resposta));
    }
}
```
