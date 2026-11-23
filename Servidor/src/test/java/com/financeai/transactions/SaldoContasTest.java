package com.financeai.transactions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;

// Teste de PedidoCalcularSaldoContas (saldo atual de cada conta: inicial + receitas - despesas +- transferencias).
class SaldoContasTest
{
    private HandlerRegistry registry;

    @BeforeEach
    void registrar ()
    {
        this.registry = new HandlerRegistry();
        new TransactionsHandler().registrarEm (this.registry);
    }

    private JsonArray saldos (String dadosJson) throws Exception
    {
        Comunicado resposta = this.registry.obter (PedidoCalcularSaldoContas.TIPO)
            .tratar (Comunicado.lerJson ("{\"tipo\":\"PedidoCalcularSaldoContas\",\"dados\":" + dadosJson + "}"));
        assertEquals (RespostaCalcularSaldoContas.TIPO, resposta.getTipo());
        return resposta.getDados().getAsJsonObject().getAsJsonArray ("saldos");
    }

    private double saldoDe (JsonArray saldos, String contaId)
    {
        for (JsonElement item : saldos)
            if (item.getAsJsonObject().get ("contaId").getAsString().equals (contaId))
                return item.getAsJsonObject().get ("saldoAtual").getAsDouble();
        throw new AssertionError ("conta ausente: " + contaId);
    }

    @Test
    void semMovimentosOSaldoEOInicial () throws Exception
    {
        JsonArray s = saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":100.5}],\"movimentos\":[]}");
        assertEquals (100.5, saldoDe (s, "a"));
    }

    @Test
    void receitaSomaEDespesaSubtrai () throws Exception
    {
        JsonArray s = saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":100}],\"movimentos\":["
            + "{\"tipo\":\"receita\",\"valor\":50,\"contaId\":\"a\"},"
            + "{\"tipo\":\"despesa\",\"valor\":30.25,\"contaId\":\"a\"}]}");
        assertEquals (119.75, saldoDe (s, "a"));
    }

    @Test
    void transferenciaSubtraiDaOrigemESomaNoDestino () throws Exception
    {
        JsonArray s = saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":100},{\"id\":\"b\",\"saldoInicial\":0}],\"movimentos\":["
            + "{\"tipo\":\"transferencia\",\"valor\":40,\"contaId\":\"a\",\"contaDestinoId\":\"b\"}]}");
        assertEquals (60.0, saldoDe (s, "a"));
        assertEquals (40.0, saldoDe (s, "b"));
    }

    @Test
    void movimentoDeContaForaDoPedidoEIgnorado () throws Exception
    {
        JsonArray s = saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":10}],\"movimentos\":["
            + "{\"tipo\":\"despesa\",\"valor\":5,\"contaId\":\"x\"},"
            + "{\"tipo\":\"transferencia\",\"valor\":4,\"contaId\":\"x\",\"contaDestinoId\":\"a\"}]}");
        assertEquals (14.0, saldoDe (s, "a"));
        assertEquals (1, s.size());
    }

    @Test
    void somaDeDecimaisEArredondadaEmDuasCasas () throws Exception
    {
        JsonArray s = saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":0.1}],\"movimentos\":["
            + "{\"tipo\":\"receita\",\"valor\":0.2,\"contaId\":\"a\"}]}");
        assertEquals (0.3, saldoDe (s, "a"));
    }

    @Test
    void semContasDevolveListaVazia () throws Exception
    {
        assertEquals (0, saldos ("{\"contas\":[],\"movimentos\":[]}").size());
    }

    @Test
    void contasAusenteEValidation ()
    {
        assertThrows (ErroDeNegocio.class, () -> saldos ("{\"movimentos\":[]}"));
    }

    @Test
    void tipoDesconhecidoEValidation ()
    {
        assertThrows (ErroDeNegocio.class, () -> saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":0}],\"movimentos\":["
            + "{\"tipo\":\"estorno\",\"valor\":1,\"contaId\":\"a\"}]}"));
    }

    @Test
    void valorZeroEValidation ()
    {
        assertThrows (ErroDeNegocio.class, () -> saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":0}],\"movimentos\":["
            + "{\"tipo\":\"receita\",\"valor\":0,\"contaId\":\"a\"}]}"));
    }

    @Test
    void transferenciaSemDestinoEValidation ()
    {
        assertThrows (ErroDeNegocio.class, () -> saldos ("{\"contas\":[{\"id\":\"a\",\"saldoInicial\":0}],\"movimentos\":["
            + "{\"tipo\":\"transferencia\",\"valor\":1,\"contaId\":\"a\"}]}"));
    }
}
