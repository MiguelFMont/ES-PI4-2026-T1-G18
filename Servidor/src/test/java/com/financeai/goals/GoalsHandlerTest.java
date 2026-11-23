/**
 * Autor: Miguel Fernandes Monteiro
 * RA: 25014808
 */
package com.financeai.goals;

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

// PedidoProgressoMeta passa pelo registry, como chega da Supervisora (JSON do Backend). O dia de referencia e fixo
// (14/11/2026) para o resultado nao depender do relogio.
class GoalsHandlerTest
{
    private static final String HOJE = "2026-11-14";

    private HandlerRegistry registry;

    @BeforeEach
    void registrar ()
    {
        this.registry = new HandlerRegistry();
        new GoalsHandler().registrarEm (this.registry);
    }

    private JsonObject progresso (double atual, double objetivo, String prazo) throws Exception
    {
        String prazoJson = prazo == null ? "null" : "\"" + prazo + "\"";
        String dados = "{\"valorAtual\":" + atual + ",\"valorObjetivo\":" + objetivo + ",\"prazo\":" + prazoJson
                     + ",\"hoje\":\"" + HOJE + "\"}";
        Comunicado resposta = this.registry.obter (PedidoProgressoMeta.TIPO)
                                           .tratar (Comunicado.lerJson ("{\"tipo\":\"PedidoProgressoMeta\",\"dados\":" + dados + "}"));
        assertEquals (RespostaProgressoMeta.TIPO, resposta.getTipo());
        return resposta.getDados().getAsJsonObject();
    }

    @Test
    void metaPelaMetadeCalculaPercentualFaltaEAporteMensal () throws Exception
    {
        // de 14/11/2026 a 14/05/2027 sao 181 dias: 7 meses de 30 dias para guardar o que falta
        JsonObject r = progresso (5000, 10000, "2027-05-14T00:00:00.000Z");

        assertEquals (50.0,    r.get("percentual").getAsDouble());
        assertEquals (5000.0,  r.get("falta").getAsDouble());
        assertFalse (r.get("concluida").getAsBoolean());
        assertTrue  (r.get("noPrazo").getAsBoolean());
        assertEquals (181,     r.get("diasRestantes").getAsInt());
        assertEquals (7,       r.get("mesesRestantes").getAsInt());
        assertEquals (714.29,  r.get("aporteMensalNecessario").getAsDouble());
    }

    @Test
    void percentualTemDuasCasasDecimais () throws Exception
    {
        assertEquals (33.33, progresso (1000, 3000, "2027-05-14").get("percentual").getAsDouble());
    }

    @Test
    void metaAtingidaFicaEm100PorCentoSemFaltaNemAporte () throws Exception
    {
        JsonObject r = progresso (12000, 10000, "2027-05-14");

        assertEquals (100.0, r.get("percentual").getAsDouble());
        assertEquals (0.0,   r.get("falta").getAsDouble());
        assertTrue   (r.get("concluida").getAsBoolean());
        assertEquals (0.0,   r.get("aporteMensalNecessario").getAsDouble());
    }

    @Test
    void metaConcluidaContaComoNoPrazoMesmoComOPrazoVencido () throws Exception
    {
        JsonObject r = progresso (10000, 10000, "2026-01-01");

        assertTrue (r.get("concluida").getAsBoolean());
        assertTrue (r.get("noPrazo").getAsBoolean());
        assertEquals (0, r.get("diasRestantes").getAsInt());
    }

    @Test
    void prazoVencidoSemConcluirFicaForaDoPrazoEPedeOQueFaltaDeUmaVez () throws Exception
    {
        JsonObject r = progresso (2500, 10000, "2026-10-01");

        assertFalse (r.get("noPrazo").getAsBoolean());
        assertEquals (0,      r.get("diasRestantes").getAsInt());
        assertEquals (1,      r.get("mesesRestantes").getAsInt());
        assertEquals (7500.0, r.get("aporteMensalNecessario").getAsDouble());
    }

    @Test
    void prazoNoProprioDiaAindaEstaNoPrazo () throws Exception
    {
        JsonObject r = progresso (100, 1000, HOJE);

        assertTrue (r.get("noPrazo").getAsBoolean());
        assertEquals (0, r.get("diasRestantes").getAsInt());
        assertEquals (900.0, r.get("aporteMensalNecessario").getAsDouble());
    }

    @Test
    void mesesRestantesSobemAoPassarDe30Dias () throws Exception
    {
        // 30 dias: 1 mes; 31 dias: 2 meses
        assertEquals (1, progresso (0, 600, "2026-12-14").get("mesesRestantes").getAsInt());

        JsonObject r = progresso (0, 600, "2026-12-15");
        assertEquals (2,     r.get("mesesRestantes").getAsInt());
        assertEquals (300.0, r.get("aporteMensalNecessario").getAsDouble());
    }

    @Test
    void valorAcumuladoNegativoContaComoZero () throws Exception
    {
        JsonObject r = progresso (-800, 5000, "2027-05-14");

        assertEquals (0.0,    r.get("percentual").getAsDouble());
        assertEquals (5000.0, r.get("falta").getAsDouble());
    }

    @Test
    void objetivoZeroOuNegativoEInvalido () throws Exception
    {
        for (double objetivo : new double[] { 0, -10 })
        {
            ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, () -> progresso (100, objetivo, "2027-05-14"));
            assertEquals ("VALIDATION", erro.getCode());
        }
    }

    @Test
    void prazoAusenteOuInvalidoEInvalido () throws Exception
    {
        for (String prazo : new String[] { null, "", "ontem", "2026-13-45", "2026-12-31T25:99:00Z" })
        {
            ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, () -> progresso (100, 1000, prazo));
            assertEquals ("VALIDATION", erro.getCode(), "prazo: " + prazo);
        }
    }

    @Test
    void semODiaDeReferenciaUsaORelogioDoServidor () throws Exception
    {
        String dados = "{\"valorAtual\":10,\"valorObjetivo\":100,\"prazo\":\"2999-01-01\"}";
        Comunicado resposta = this.registry.obter (PedidoProgressoMeta.TIPO)
                                           .tratar (Comunicado.lerJson ("{\"tipo\":\"PedidoProgressoMeta\",\"dados\":" + dados + "}"));

        assertTrue (resposta.getDados().getAsJsonObject().get("noPrazo").getAsBoolean());
    }
}
