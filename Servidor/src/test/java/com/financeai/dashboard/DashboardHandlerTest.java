// CEZAR AUGUSTO FERNANDEZ RULL - 25007452

package com.financeai.dashboard;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

// Teste do Grupo 3 (Painel): indicadores e comparacao de periodos, pelo HandlerRegistry.
// INTRACLASSE de DashboardHandler. Particionamento por categorias de metodos (indicadores, comparacao) e por atributos
// (receitas zero, despesas maiores que receitas, um periodo so, anterior zero, tendencia alta, queda e estavel).
// INTERCLASSE: o pedido percorre HandlerRegistry -> DashboardHandler -> Comunicado e volta como Resposta.
class DashboardHandlerTest
{
    private HandlerRegistry registry;

    @BeforeEach
    void registrar ()
    {
        this.registry = new HandlerRegistry();
        new DashboardHandler().registrarEm (this.registry);
    }

    private JsonObject pedir (String tipo, String dados) throws Exception
    {
        Comunicado resposta = this.registry.obter (tipo).tratar (Comunicado.lerJson ("{\"tipo\":\"" + tipo + "\",\"dados\":" + dados + "}"));
        return resposta.getDados().getAsJsonObject();
    }

    private JsonObject comparar (String periodos) throws Exception
    {
        return pedir (PedidoCompararPeriodos.TIPO, "{\"periodos\":" + periodos + "}");
    }

    // ---------------- Indicadores ----------------

    @Test
    void indicadoresCalculamSaldoEconomiaEFluxo () throws Exception
    {
        JsonObject r = pedir (PedidoCalcularIndicadores.TIPO, "{\"receitas\":5000,\"despesas\":3000}");

        assertEquals (2000.0, r.get ("saldo").getAsDouble());
        assertEquals (40.0, r.get ("economia").getAsDouble());
        assertEquals (2000.0, r.get ("fluxoDeCaixa").getAsDouble());
    }

    @Test
    void semReceitasAEconomiaEZero () throws Exception
    {
        JsonObject r = pedir (PedidoCalcularIndicadores.TIPO, "{\"receitas\":0,\"despesas\":300}");

        assertEquals (-300.0, r.get ("saldo").getAsDouble());
        assertEquals (0.0, r.get ("economia").getAsDouble());
    }

    @Test
    void despesasMaioresQueReceitasDaSaldoEEconomiaNegativos () throws Exception
    {
        JsonObject r = pedir (PedidoCalcularIndicadores.TIPO, "{\"receitas\":1000,\"despesas\":1500}");

        assertEquals (-500.0, r.get ("saldo").getAsDouble());
        assertEquals (-50.0, r.get ("economia").getAsDouble());
    }

    // ---------------- Comparacao de periodos ----------------

    @Test
    void umPeriodoSoNaoTemVariacaoENemTendencia () throws Exception
    {
        JsonObject r = comparar ("[{\"rotulo\":\"nov\",\"receitas\":1000,\"despesas\":400}]");
        JsonObject linha = r.getAsJsonArray ("periodos").get (0).getAsJsonObject();

        assertEquals (600.0, linha.get ("saldo").getAsDouble());
        assertEquals (0.0, linha.get ("variacaoDespesas").getAsDouble());
        assertEquals ("estavel", r.get ("tendenciaDespesas").getAsString());
    }

    @Test
    void variacaoEmPorcentagemEmRelacaoAoPeriodoAnterior () throws Exception
    {
        JsonObject r = comparar ("[{\"rotulo\":\"out\",\"receitas\":1000,\"despesas\":400},{\"rotulo\":\"nov\",\"receitas\":1100,\"despesas\":500}]");
        JsonArray lista = r.getAsJsonArray ("periodos");

        assertEquals (10.0, lista.get (1).getAsJsonObject().get ("variacaoReceitas").getAsDouble());
        assertEquals (25.0, lista.get (1).getAsJsonObject().get ("variacaoDespesas").getAsDouble());
        assertEquals ("alta", r.get ("tendenciaDespesas").getAsString());
    }

    @Test
    void tendenciaDeQuedaQuandoAsDespesasCaemMaisDeCincoPorCento () throws Exception
    {
        JsonObject r = comparar ("[{\"receitas\":1000,\"despesas\":500},{\"receitas\":1000,\"despesas\":400}]");

        assertEquals ("queda", r.get ("tendenciaDespesas").getAsString());
    }

    @Test
    void variacaoDentroDeCincoPorCentoEEstavel () throws Exception
    {
        JsonObject r = comparar ("[{\"receitas\":1000,\"despesas\":500},{\"receitas\":1000,\"despesas\":520}]");

        assertEquals ("estavel", r.get ("tendenciaDespesas").getAsString());
    }

    @Test
    void periodoAnteriorZeradoNaoGeraDivisaoPorZero () throws Exception
    {
        JsonObject r = comparar ("[{\"receitas\":0,\"despesas\":0},{\"receitas\":100,\"despesas\":50}]");
        JsonObject segundo = r.getAsJsonArray ("periodos").get (1).getAsJsonObject();

        assertEquals (0.0, segundo.get ("variacaoReceitas").getAsDouble());
        assertEquals (0.0, segundo.get ("variacaoDespesas").getAsDouble());
    }

    @Test
    void listaVaziaOuAusenteEErroDeValidacao ()
    {
        for (String dados : new String[] { "{\"periodos\":[]}", "{}" })
        {
            ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, () -> pedir (PedidoCompararPeriodos.TIPO, dados));
            assertEquals ("VALIDATION", erro.getCode());
        }
    }

    @Test
    void valorQueNaoEUmNumeroEErroDeValidacao ()
    {
        ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, () -> comparar ("[{\"receitas\":\"mil\",\"despesas\":10}]"));
        assertEquals ("VALIDATION", erro.getCode());
    }
}
