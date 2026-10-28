package com.financeai.mentoria;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;
import com.financeai.mentoria.PedidoMontarContextoIA.Transacao;

// Grupo 4 (Mentor Financeiro). A chamada a API de IA e feita pelo Backend, entre os
// dois pedidos: PedidoMontarContextoIA -> IA -> PedidoFiltrarResposta.
public class MentorHandler
{
    private static final Locale PT_BR = Locale.forLanguageTag ("pt-BR");

    // limites para o contexto caber no orcamento de tokens da IA
    private static final int MAX_CATEGORIAS        = 8;
    private static final int MAIORES_DESPESAS      = 3;
    private static final int MAX_CARACTERES_DESCR  = 40;

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoMontarContextoIA.TIPO, this::montarContexto);
        registry.registrar (PedidoFiltrarResposta.TIPO,  this::filtrarResposta);
    }

    // Faz todas as contas do mes (a IA erra calculos) e devolve um resumo em texto,
    // com os numeros ja formatados, para virar o contexto do prompt.
    private Comunicado montarContexto (Comunicado pedido) throws Exception
    {
        PedidoMontarContextoIA p = pedido.dadosComo (PedidoMontarContextoIA.class);

        if (p.getDiaDoMes() < 1 || p.getDiaDoMes() > 31)
            throw new ErroDeNegocio ("VALIDATION", "diaDoMes deve estar entre 1 e 31");

        List<Transacao> transacoes = p.getTransacoes() == null ? new ArrayList<Transacao>() : p.getTransacoes();

        double receitas = 0, despesas = 0;
        Map<String, Double> porCategoria = new HashMap<String, Double>();
        List<Transacao> listaDespesas = new ArrayList<Transacao>();

        for (Transacao t : transacoes)
        {
            if (t == null || t.getValor() < 0)
                throw new ErroDeNegocio ("VALIDATION", "Transacao invalida");

            if ("receita".equals(t.getTipo()))
                receitas += t.getValor();
            else if ("despesa".equals(t.getTipo()))
            {
                despesas += t.getValor();
                listaDespesas.add (t);
                String categoria = t.getCategoria() == null || t.getCategoria().isBlank() ? "Outros" : t.getCategoria();
                porCategoria.merge (categoria, t.getValor(), Double::sum);
            }
            else
                throw new ErroDeNegocio ("VALIDATION", "tipo deve ser receita ou despesa");
        }

        String contexto = transacoes.isEmpty()
            ? "Nenhuma transação registrada neste mês (até o dia " + p.getDiaDoMes() + ")."
            : resumo (p.getDiaDoMes(), receitas, despesas, porCategoria, listaDespesas);

        return Comunicado.de (RespostaMontarContextoIA.TIPO, new RespostaMontarContextoIA(contexto));
    }

    private static String resumo (int dia, double receitas, double despesas,
                                  Map<String, Double> porCategoria, List<Transacao> listaDespesas)
    {
        double saldo = receitas - despesas;
        StringBuilder s = new StringBuilder();

        s.append ("Mês atual (até o dia ").append (dia).append ("): ");
        s.append ("receitas ").append (reais(receitas));
        s.append ("; despesas ").append (reais(despesas));
        s.append ("; saldo ").append (reais(saldo));
        if (receitas > 0)
            s.append ("; poupança ").append (porcento(saldo / receitas)).append (" da renda");
        else
            s.append ("; sem receitas registradas, poupança não calculável");
        s.append (".\n");

        if (despesas > 0)
        {
            List<Map.Entry<String, Double>> categorias = new ArrayList<Map.Entry<String, Double>>(porCategoria.entrySet());
            categorias.sort (Map.Entry.<String, Double>comparingByValue().reversed());

            s.append ("Despesas por categoria: ");
            double outras = 0;
            for (int i = 0; i < categorias.size(); i++)
            {
                if (i >= MAX_CATEGORIAS)
                {
                    outras += categorias.get(i).getValue();
                    continue;
                }
                if (i > 0) s.append ("; ");
                s.append (categorias.get(i).getKey()).append (' ')
                 .append (reais(categorias.get(i).getValue()))
                 .append (" (").append (porcento(categorias.get(i).getValue() / despesas)).append (')');
            }
            if (outras > 0)
                s.append ("; demais categorias ").append (reais(outras))
                 .append (" (").append (porcento(outras / despesas)).append (')');
            s.append (".\n");

            s.append ("Média diária de gastos: ").append (reais(despesas / dia)).append (".\n");

            listaDespesas.sort (Comparator.comparingDouble(Transacao::getValor).reversed());
            s.append ("Maiores despesas: ");
            for (int i = 0; i < Math.min(MAIORES_DESPESAS, listaDespesas.size()); i++)
            {
                if (i > 0) s.append ("; ");
                s.append (descricao(listaDespesas.get(i))).append (' ').append (reais(listaDespesas.get(i).getValor()));
            }
            s.append ('.');
        }
        else
            s.append ("Nenhuma despesa registrada neste mês.");

        return s.toString();
    }

    private Comunicado filtrarResposta (Comunicado pedido) throws Exception
    {
        PedidoFiltrarResposta p = pedido.dadosComo (PedidoFiltrarResposta.class);

        return Comunicado.de (RespostaFiltrarResposta.TIPO,
                              new RespostaFiltrarResposta(FiltroDeAtivos.filtrar(p.getResposta())));
    }

    // a descricao e texto livre do usuario: vai curta e numa linha so para o prompt
    private static String descricao (Transacao t)
    {
        String d = t.getDescricao() == null ? "" : t.getDescricao().replaceAll ("\\s+", " ").strip();
        if (d.isEmpty()) return "Sem descrição";
        return d.length() > MAX_CARACTERES_DESCR ? d.substring(0, MAX_CARACTERES_DESCR) + "..." : d;
    }

    // "R$ 1.400,00" (o NumberFormat usa espaco nao separavel; trocamos por espaco comum)
    private static String reais (double valor)
    {
        return NumberFormat.getCurrencyInstance(PT_BR).format(valor).replace (' ', ' ');
    }

    // "36,8%"
    private static String porcento (double fracao)
    {
        return String.format (PT_BR, "%.1f%%", fracao * 100);
    }
}
