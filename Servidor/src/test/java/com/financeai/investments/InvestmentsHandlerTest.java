package com.financeai.investments;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.google.gson.JsonObject;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

// Os pedidos de investimentos e parcelamentos passam pelo registry, como chegam da Supervisora (JSON do Backend).
// Os valores esperados foram calculados por fora do codigo (juros compostos e tabela Price), nao pela mesma formula.
class InvestmentsHandlerTest
{
    private static final double CENTAVO = 0.011;

    private HandlerRegistry registry;

    @BeforeEach
    void registrar ()
    {
        this.registry = new HandlerRegistry();
        new InvestmentsHandler().registrarEm (this.registry);
    }

    private JsonObject enviar (String tipo, String resposta, String dadosJson) throws Exception
    {
        Comunicado r = this.registry.obter (tipo)
                                    .tratar (Comunicado.lerJson ("{\"tipo\":\"" + tipo + "\",\"dados\":" + dadosJson + "}"));
        assertEquals (resposta, r.getTipo());
        return r.getDados().getAsJsonObject();
    }

    private JsonObject rentabilidade (String dadosJson) throws Exception
    {
        return enviar (PedidoRentabilidadeSimulada.TIPO, RespostaRentabilidadeSimulada.TIPO, dadosJson);
    }

    private JsonObject parcelamentos (String dadosJson) throws Exception
    {
        return enviar (PedidoCalcularParcelamentos.TIPO, RespostaCalcularParcelamentos.TIPO, dadosJson);
    }

    private static JsonObject item (JsonObject resposta, String lista, int posicao)
    {
        return resposta.getAsJsonArray (lista).get (posicao).getAsJsonObject();
    }

    private static void assertErro (String codigo, org.junit.jupiter.api.function.Executable acao)
    {
        ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, acao);
        assertEquals (codigo, erro.getCode());
    }

    // ---------------------------------------------------------------- rentabilidade

    @Test
    void jurosCompostosPorAtivoComMesesProprios () throws Exception
    {
        // 1000 a 1% ao mes por 12 meses = 1126,83; 2000 a 0,5% ao mes por 6 meses = 2060,76
        JsonObject r = rentabilidade ("{\"ativos\":["
            + "{\"id\":\"a1\",\"nome\":\"CDB\",\"valor\":1000,\"taxaMensal\":1,\"meses\":12},"
            + "{\"id\":\"a2\",\"nome\":\"Tesouro\",\"valor\":2000,\"taxaMensal\":0.5,\"meses\":6}]}");

        JsonObject cdb = item (r, "ativos", 0);
        assertEquals ("a1",    cdb.get("id").getAsString());
        assertEquals ("CDB",   cdb.get("nome").getAsString());
        assertEquals (1126.83, cdb.get("valorAtual").getAsDouble(),    CENTAVO);
        assertEquals (126.83,  cdb.get("rendimento").getAsDouble(),    CENTAVO);
        assertEquals (12.68,   cdb.get("rentabilidade").getAsDouble(), CENTAVO);
        assertEquals (35.35,   cdb.get("percentualCarteira").getAsDouble(), CENTAVO);

        JsonObject tesouro = item (r, "ativos", 1);
        assertEquals (2060.76, tesouro.get("valorAtual").getAsDouble(), CENTAVO);
        assertEquals (64.65,   tesouro.get("percentualCarteira").getAsDouble(), CENTAVO);

        assertEquals (3000.0,  r.get("totalInvestido").getAsDouble());
        assertEquals (3187.58, r.get("patrimonio").getAsDouble(),    CENTAVO);
        assertEquals (187.58,  r.get("rendimento").getAsDouble(),    CENTAVO);
        assertEquals (6.25,    r.get("rentabilidade").getAsDouble(), CENTAVO);
    }

    @Test
    void semMesesNoPedidoRendeUmMes () throws Exception
    {
        JsonObject r = rentabilidade ("{\"ativos\":[{\"valor\":1000,\"taxaMensal\":1}]}");
        assertEquals (1010.0, item (r, "ativos", 0).get("valorAtual").getAsDouble(), CENTAVO);
    }

    @Test
    void mesesDoPedidoValemParaOAtivoQueNaoTemOsProprios () throws Exception
    {
        JsonObject r = rentabilidade ("{\"meses\":12,\"ativos\":[{\"valor\":1000,\"taxaMensal\":1}]}");
        assertEquals (1126.83, item (r, "ativos", 0).get("valorAtual").getAsDouble(), CENTAVO);
    }

    @Test
    void semTaxaOValorNaoMuda () throws Exception
    {
        JsonObject r = rentabilidade ("{\"meses\":24,\"ativos\":[{\"valor\":500}]}");
        JsonObject a = item (r, "ativos", 0);

        assertEquals (500.0, a.get("valorAtual").getAsDouble());
        assertEquals (0.0,   a.get("rendimento").getAsDouble());
        assertEquals (100.0, a.get("percentualCarteira").getAsDouble());
    }

    @Test
    void taxaNegativaReduzOValor () throws Exception
    {
        JsonObject r = rentabilidade ("{\"meses\":1,\"ativos\":[{\"valor\":1000,\"taxaMensal\":-2}]}");
        assertEquals (980.0, item (r, "ativos", 0).get("valorAtual").getAsDouble(), CENTAVO);
        assertEquals (-2.0,  item (r, "ativos", 0).get("rentabilidade").getAsDouble(), CENTAVO);
    }

    @Test
    void carteiraVaziaOuAusenteDevolveZerosSemErro () throws Exception
    {
        for (String dados : new String[] { "{\"ativos\":[]}", "{}" })
        {
            JsonObject r = rentabilidade (dados);
            assertEquals (0, r.getAsJsonArray("ativos").size());
            assertEquals (0.0, r.get("patrimonio").getAsDouble());
            assertEquals (0.0, r.get("rentabilidade").getAsDouble());
        }
    }

    @Test
    void ativoInvalidoRecusaOPedido ()
    {
        assertErro ("VALIDATION", () -> rentabilidade ("{\"ativos\":[{\"valor\":0}]}"));
        assertErro ("VALIDATION", () -> rentabilidade ("{\"ativos\":[{\"valor\":-5}]}"));
        assertErro ("VALIDATION", () -> rentabilidade ("{\"ativos\":[{\"valor\":100,\"taxaMensal\":-100}]}"));
        assertErro ("VALIDATION", () -> rentabilidade ("{\"ativos\":[{\"valor\":100,\"meses\":-1}]}"));
        assertErro ("VALIDATION", () -> rentabilidade ("{\"ativos\":[{\"valor\":100,\"meses\":1.5}]}"));
        assertErro ("VALIDATION", () -> rentabilidade ("{\"ativos\":[{\"valor\":\"muito\"}]}"));
        assertErro ("VALIDATION", () -> rentabilidade ("{\"meses\":-3,\"ativos\":[{\"valor\":100}]}"));
    }

    // ---------------------------------------------------------------- parcelamentos

    @Test
    void parcelamentoComJurosUsaATabelaPrice () throws Exception
    {
        // 1000 em 10x a 2% ao mes: parcela 111,33; 4 pagas, faltam 6; saldo devedor 623,59; juros 113,27
        JsonObject r = parcelamentos ("{\"parcelamentos\":[{\"id\":\"p1\",\"descricao\":\"Notebook\","
            + "\"valorTotal\":1000,\"parcelas\":10,\"parcelasPagas\":4,\"taxaJurosMensal\":2}]}");
        JsonObject p = item (r, "parcelamentos", 0);

        assertEquals ("p1",       p.get("id").getAsString());
        assertEquals ("Notebook", p.get("descricao").getAsString());
        assertEquals (111.33, p.get("valorParcela").getAsDouble(),  CENTAVO);
        assertEquals (6,      p.get("parcelasRestantes").getAsInt());
        assertEquals (623.59, p.get("saldoDevedor").getAsDouble(),  CENTAVO);
        assertEquals (113.27, p.get("jurosTotal").getAsDouble(),    CENTAVO);
        assertFalse (p.get("quitado").getAsBoolean());
    }

    @Test
    void parcelamentoSemJurosDivideIgualEOSaldoEAProporcional () throws Exception
    {
        JsonObject r = parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":1200,\"parcelas\":12,\"parcelasPagas\":3}]}");
        JsonObject p = item (r, "parcelamentos", 0);

        assertEquals (100.0, p.get("valorParcela").getAsDouble());
        assertEquals (900.0, p.get("saldoDevedor").getAsDouble());
        assertEquals (0.0,   p.get("jurosTotal").getAsDouble());
    }

    @Test
    void parcelamentoQuitadoTemSaldoZeroENaoEntraNosTotais () throws Exception
    {
        JsonObject r = parcelamentos ("{\"parcelamentos\":["
            + "{\"valorTotal\":1000,\"parcelas\":10,\"parcelasPagas\":4,\"taxaJurosMensal\":2},"
            + "{\"valorTotal\":1200,\"parcelas\":12,\"parcelasPagas\":3},"
            + "{\"valorTotal\":600,\"parcelas\":3,\"parcelasPagas\":3}]}");

        JsonObject quitado = item (r, "parcelamentos", 2);
        assertTrue (quitado.get("quitado").getAsBoolean());
        assertEquals (0, quitado.get("parcelasRestantes").getAsInt());
        assertEquals (0.0, quitado.get("saldoDevedor").getAsDouble());

        // 111,33 + 100 (a de 200 ja foi quitada) / 623,59 + 900 / 113,27
        assertEquals (211.33,  r.get("totalParcelasDoMes").getAsDouble(), CENTAVO);
        assertEquals (1523.59, r.get("totalSaldoDevedor").getAsDouble(),  CENTAVO);
        assertEquals (113.27,  r.get("totalJuros").getAsDouble(),         CENTAVO);
    }

    @Test
    void semNenhumParcelamentoDevolveZeros () throws Exception
    {
        for (String dados : new String[] { "{\"parcelamentos\":[]}", "{}" })
        {
            JsonObject r = parcelamentos (dados);
            assertEquals (0, r.getAsJsonArray("parcelamentos").size());
            assertEquals (0.0, r.get("totalParcelasDoMes").getAsDouble());
            assertEquals (0.0, r.get("totalSaldoDevedor").getAsDouble());
        }
    }

    @Test
    void parcelamentoInvalidoRecusaOPedido ()
    {
        assertErro ("VALIDATION", () -> parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":0,\"parcelas\":3}]}"));
        assertErro ("VALIDATION", () -> parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":100,\"parcelas\":0}]}"));
        assertErro ("VALIDATION", () -> parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":100}]}"));
        assertErro ("VALIDATION", () -> parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":100,\"parcelas\":3,\"parcelasPagas\":4}]}"));
        assertErro ("VALIDATION", () -> parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":100,\"parcelas\":3,\"parcelasPagas\":-1}]}"));
        assertErro ("VALIDATION", () -> parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":100,\"parcelas\":2.5}]}"));
        assertErro ("VALIDATION", () -> parcelamentos ("{\"parcelamentos\":[{\"valorTotal\":100,\"parcelas\":3,\"taxaJurosMensal\":-1}]}"));
    }
}
