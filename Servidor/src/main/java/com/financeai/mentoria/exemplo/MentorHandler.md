# MentorHandler.java — Handlers do Grupo 4 (Mentor Financeiro com IA)

## O que deve ter neste arquivo
- Registra cinco pedidos: `PedidoMontarContextoIA`, `PedidoFiltrarResposta`, `PedidoSalvarTrocaChat`, `PedidoHistoricoChat` e `PedidoListarAlertas`. A chamada à **API de IA generativa não acontece aqui**: ela fica no Backend, entre o contexto e o filtro (ele tem a `GENAI_API_KEY` e acesso à internet).
- `montarContexto`: lê as últimas transações do usuário (`MentorRepository`) e devolve um texto resumido, pronto para virar o contexto do prompt.
- `filtrarResposta`: garante a restrição do grupo, **nunca recomendar compra ou venda de um ativo específico**, sem depender só do prompt. O exemplo troca por um aviso qualquer resposta que combine verbo de compra/venda com código de ativo (ex.: `PETR4`) ou nome de criptomoeda; a versão real pode ser mais completa. A regra de segurança fica no Servidor de propósito: não é contornável por uma mudança de prompt.
- `salvarTroca`, `historico` e `listarAlertas`: persistência e leitura do chat e dos alertas, via `MentorRepository`.

## Exemplo de implementação

```java
package com.financeai.mentoria;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.bson.Document;

import com.financeai.core.Banco;
import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class MentorHandler
{
    private static final Pattern RECOMENDACAO = Pattern.compile (
        "(?i)(compr(e|ar)|vend(a|er)|aport(e|ar)).*(\\b[A-Z]{4}\\d{1,2}\\b|bitcoin|ethereum)");

    private static final String AVISO =
        "Nao posso recomendar a compra ou venda de ativos especificos. "
      + "Posso ajudar a entender seu perfil e seus gastos.";

    private final MentorRepository repositorio = new MentorRepository();

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoMontarContextoIA.TIPO, this::montarContexto);
        registry.registrar (PedidoFiltrarResposta.TIPO,  this::filtrarResposta);
        registry.registrar (PedidoSalvarTrocaChat.TIPO,  this::salvarTroca);
        registry.registrar (PedidoHistoricoChat.TIPO,    this::historico);
        registry.registrar (PedidoListarAlertas.TIPO,    this::listarAlertas);
    }

    private Comunicado montarContexto (Comunicado pedido) throws Exception
    {
        PedidoMontarContextoIA p = pedido.dadosComo (PedidoMontarContextoIA.class);

        double receitas = 0, despesas = 0;
        StringBuilder lista = new StringBuilder();

        for (Document t : this.repositorio.ultimasTransacoes (p.getUserId(), 10))
        {
            double valor = ((Number) t.get ("valor")).doubleValue();
            if ("receita".equals (t.getString ("tipo"))) receitas += valor;
            else                                         despesas += valor;
            lista.append (t.getString ("descricao")).append (" (R$ ").append (String.format ("%.2f", valor)).append ("); ");
        }

        String contexto = String.format (
            "Nas ultimas 10 transacoes: receitas R$ %.2f e despesas R$ %.2f. Detalhe: %s", receitas, despesas, lista);

        return Comunicado.de (RespostaMontarContextoIA.TIPO, new RespostaMontarContextoIA (contexto));
    }

    private Comunicado filtrarResposta (Comunicado pedido) throws Exception
    {
        PedidoFiltrarResposta p = pedido.dadosComo (PedidoFiltrarResposta.class);

        String resposta = RECOMENDACAO.matcher (p.getResposta()).find() ? AVISO : p.getResposta();

        return Comunicado.de (RespostaFiltrarResposta.TIPO, new RespostaFiltrarResposta (resposta));
    }

    private Comunicado salvarTroca (Comunicado pedido) throws Exception
    {
        PedidoSalvarTrocaChat p = pedido.dadosComo (PedidoSalvarTrocaChat.class);

        this.repositorio.salvarTroca (p.getUserId(), p.getMensagemUsuario(), p.getRespostaIA());

        return Comunicado.de (RespostaSalvarTrocaChat.TIPO, new RespostaSalvarTrocaChat (true));
    }

    private Comunicado historico (Comunicado pedido) throws Exception
    {
        PedidoHistoricoChat p = pedido.dadosComo (PedidoHistoricoChat.class);

        List<Map<String, Object>> mensagens = new ArrayList<>();
        for (Document d : this.repositorio.historico (p.getUserId()))
            mensagens.add (Banco.paraMapa (d));

        return Comunicado.de (RespostaHistoricoChat.TIPO, new RespostaHistoricoChat (mensagens));
    }

    private Comunicado listarAlertas (Comunicado pedido) throws Exception
    {
        PedidoListarAlertas p = pedido.dadosComo (PedidoListarAlertas.class);

        List<Map<String, Object>> alertas = new ArrayList<>();
        for (Document d : this.repositorio.alertas (p.getUserId()))
            alertas.add (Banco.paraMapa (d));

        return Comunicado.de (RespostaListarAlertas.TIPO, new RespostaListarAlertas (alertas));
    }
}
```
