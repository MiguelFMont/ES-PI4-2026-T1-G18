package com.financeai.mentoria;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

// Os pedidos do Mentor IA passam pelo registry, como chegam da Supervisora (JSON do Backend).
class MentorHandlerTest
{
    private HandlerRegistry registry;

    @BeforeEach
    void registrar ()
    {
        this.registry = new HandlerRegistry();
        new MentorHandler().registrarEm (this.registry);
    }

    private Comunicado enviar (String tipo, String dadosJson) throws Exception
    {
        return this.registry.obter (tipo)
                            .tratar (Comunicado.lerJson ("{\"tipo\":\"" + tipo + "\",\"dados\":" + dadosJson + "}"));
    }

    private String contexto (String dadosJson) throws Exception
    {
        Comunicado resposta = enviar (PedidoMontarContextoIA.TIPO, dadosJson);
        assertEquals (RespostaMontarContextoIA.TIPO, resposta.getTipo());
        return resposta.getDados().getAsJsonObject().get("contexto").getAsString();
    }

    private static String transacao (String tipo, double valor, String categoria, String descricao)
    {
        return "{\"tipo\":\"" + tipo + "\",\"valor\":" + valor + ",\"categoria\":\"" + categoria
             + "\",\"descricao\":\"" + descricao + "\",\"data\":\"2026-11-05T12:00:00.000Z\"}";
    }

    private static String pedido (int diaDoMes, String... transacoes)
    {
        return "{\"diaDoMes\":" + diaDoMes + ",\"transacoes\":[" + String.join (",", transacoes) + "]}";
    }

    @Test
    void montaResumoComTotaisPercentuaisMediaEMaioresDespesas () throws Exception
    {
        String dados = pedido (30,
            transacao ("receita", 4500,  "Salário",     "Salário"),
            transacao ("despesa", 1400,  "Moradia",     "Aluguel"),
            transacao ("despesa", 250,   "Alimentação", "Mercado"),
            transacao ("despesa", 50,    "Alimentação", "Padaria"),
            transacao ("despesa", 100,   "Lazer",       "Cinema"));

        assertEquals (
            "Mês atual (até o dia 30): receitas R$ 4.500,00; despesas R$ 1.800,00; saldo R$ 2.700,00; poupança 60,0% da renda.\n"
          + "Despesas por categoria: Moradia R$ 1.400,00 (77,8%); Alimentação R$ 300,00 (16,7%); Lazer R$ 100,00 (5,6%).\n"
          + "Média diária de gastos: R$ 60,00.\n"
          + "Maiores despesas: Aluguel R$ 1.400,00; Mercado R$ 250,00; Cinema R$ 100,00.",
            contexto (dados));
    }

    @Test
    void valoresUsamEspacoComumEFormatoBrasileiro () throws Exception
    {
        String texto = contexto (pedido (10, transacao ("despesa", 1400, "Moradia", "Aluguel")));

        assertTrue (texto.contains ("despesas R$ 1.400,00;"), texto);
        assertTrue (texto.indexOf (' ') < 0, "sem espaço não separável no texto da IA");
    }

    @Test
    void semReceitasNaoCalculaPoupanca () throws Exception
    {
        String texto = contexto (pedido (5, transacao ("despesa", 100, "Lazer", "Cinema")));

        assertTrue (texto.startsWith ("Mês atual (até o dia 5): receitas R$ 0,00; despesas R$ 100,00; saldo -R$ 100,00;"), texto);
        assertTrue (texto.contains ("sem receitas registradas, poupança não calculável"), texto);
    }

    @Test
    void semDespesasAvisaQueNaoHaDespesas () throws Exception
    {
        String texto = contexto (pedido (5, transacao ("receita", 4500, "Salário", "Salário")));

        assertTrue (texto.contains ("poupança 100,0% da renda"), texto);
        assertTrue (texto.endsWith ("Nenhuma despesa registrada neste mês."), texto);
    }

    @Test
    void semTransacoesDevolveMensagemDeMesVazio () throws Exception
    {
        assertEquals ("Nenhuma transação registrada neste mês (até o dia 7).", contexto ("{\"diaDoMes\":7,\"transacoes\":[]}"));
        assertEquals ("Nenhuma transação registrada neste mês (até o dia 7).", contexto ("{\"diaDoMes\":7}"));
    }

    @Test
    void maisDeOitoCategoriasViramDemaisCategorias () throws Exception
    {
        String[] transacoes = new String[10];
        for (int i = 0; i < 10; i++)
            transacoes[i] = transacao ("despesa", 100 - i, "Categoria " + i, "Gasto " + i);

        String texto = contexto (pedido (10, transacoes));

        assertTrue (texto.contains ("Categoria 7 R$ 93,00"), texto);
        assertTrue (!texto.contains ("Categoria 8") && !texto.contains ("Categoria 9"), texto);
        // 92 + 91 = 183 de 955
        assertTrue (texto.contains ("; demais categorias R$ 183,00 (19,2%)."), texto);
    }

    @Test
    void descricaoECategoriaSaoNormalizadas () throws Exception
    {
        String longa = "Compra   parcelada\\n de eletrodomésticos para a casa nova";
        String texto = contexto (pedido (10,
            transacao ("despesa", 300, "",  longa),
            transacao ("despesa", 200, " ", "  ")));

        assertTrue (texto.contains ("Outros R$ 500,00 (100,0%)"), texto);
        // espacos e quebras de linha viram um espaco; corta em 40 caracteres
        assertTrue (texto.contains ("Maiores despesas: Compra parcelada de eletrodomésticos par... R$ 300,00; Sem descrição R$ 200,00."), texto);
    }

    @ParameterizedTest
    @ValueSource (ints = { 0, 32, -1 })
    void diaDoMesForaDe1a31EhErroDeValidacao (int dia)
    {
        ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, () -> contexto (pedido (dia)));
        assertEquals ("VALIDATION", erro.getCode());
    }

    @Test
    void tipoInvalidoEhErroDeValidacao ()
    {
        ErroDeNegocio erro = assertThrows (ErroDeNegocio.class,
            () -> contexto (pedido (10, transacao ("transferencia", 100, "Outros", "Pix"))));
        assertEquals ("VALIDATION", erro.getCode());
    }

    @Test
    void valorNegativoOuTransacaoNulaEhErroDeValidacao ()
    {
        ErroDeNegocio negativo = assertThrows (ErroDeNegocio.class,
            () -> contexto (pedido (10, transacao ("despesa", -5, "Lazer", "Cinema"))));
        assertEquals ("VALIDATION", negativo.getCode());

        ErroDeNegocio nula = assertThrows (ErroDeNegocio.class, () -> contexto (pedido (10, "null")));
        assertEquals ("VALIDATION", nula.getCode());
    }

    @Test
    void filtrarRespostaPeloRegistryUsaOFiltroDeAtivos () throws Exception
    {
        Comunicado resposta = enviar (PedidoFiltrarResposta.TIPO, "{\"resposta\":\"Compre PETR4 agora.\"}");

        assertEquals (RespostaFiltrarResposta.TIPO, resposta.getTipo());
        assertEquals (FiltroDeAtivos.AVISO,
                      resposta.getDados().getAsJsonObject().get("respostaFiltrada").getAsString());
    }

    @Test
    void filtrarRespostaPeloRegistryUsaOFiltroDeEscopo () throws Exception
    {
        String codigo = "Claro! ```python\\ndef soma(a, b):\\n    return a + b\\n```";
        Comunicado resposta = enviar (PedidoFiltrarResposta.TIPO, "{\"resposta\":\"" + codigo + "\"}");

        assertEquals (FiltroDeEscopo.AVISO,
                      resposta.getDados().getAsJsonObject().get("respostaFiltrada").getAsString());
    }
}
