package com.financeai.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.google.gson.JsonObject;

// Teste INTRACLASSE de Comunicado (a mensagem trocada com o Backend, uma linha de JSON).
// Particionamento 1: ESTADOS do objeto (valido, dados ausentes, tipo invalido, vindo do JSON).
// Particionamento 2: CATEGORIAS DE METODOS (construtor, fabricas, conversao de/para JSON, acesso).
class ComunicadoTest
{
    // ---------------- Estados ----------------

    @Test
    void estadoValidoGuardaTipoEDados ()
    {
        JsonObject dados = new JsonObject();
        dados.addProperty ("x", 1);
        Comunicado c = new Comunicado ("Teste", dados);
        assertEquals ("Teste", c.getTipo());
        assertEquals (1, c.getDados().getAsJsonObject().get ("x").getAsInt());
    }

    @Test
    void estadoSemDadosViraObjetoVazio ()
    {
        Comunicado c = new Comunicado ("Teste", null);
        assertNotNull (c.getDados());
        assertTrue (c.getDados().getAsJsonObject().isEmpty());
    }

    @Test
    void estadoComTipoAusenteOuEmBrancoEhRecusado ()
    {
        assertThrows (IllegalArgumentException.class, () -> new Comunicado (null, null));
        assertThrows (IllegalArgumentException.class, () -> new Comunicado ("   ", null));
    }

    @Test
    void estadoVindoDoJsonSemDadosTambemViraObjetoVazio ()
    {
        Comunicado c = Comunicado.lerJson ("{\"tipo\":\"Teste\"}");
        assertTrue (c.getDados().getAsJsonObject().isEmpty());
    }

    // ---------------- Categorias de metodos ----------------

    @Test
    void fabricasCriamOsTiposEspeciais ()
    {
        assertEquals (Comunicado.TIPO_DESLIGAMENTO, Comunicado.desligamento().getTipo());
        Comunicado erro = Comunicado.erro ("VALIDATION", "msg");
        assertEquals (Comunicado.TIPO_ERRO, erro.getTipo());
        assertEquals ("VALIDATION", erro.getDados().getAsJsonObject().get ("code").getAsString());
        assertEquals ("INTERNAL_ERROR", Comunicado.erro ("so mensagem").getDados().getAsJsonObject().get ("code").getAsString());
    }

    @Test
    void deConverteUmObjetoEmDadosEDadosComoVoltaAoObjeto ()
    {
        Comunicado c = Comunicado.de ("Resp", new RespostaDeTeste ("ok"));
        assertEquals ("ok", c.dadosComo (RespostaDeTeste.class).texto);
    }

    @Test
    void paraJsonELerJsonSaoInversos ()
    {
        Comunicado original = Comunicado.de ("Resp", new RespostaDeTeste ("ok"));
        Comunicado lido = Comunicado.lerJson (original.paraJson());
        assertEquals (original.getTipo(), lido.getTipo());
        assertEquals ("ok", lido.dadosComo (RespostaDeTeste.class).texto);
    }

    @Test
    void lerJsonRecusaLinhaSemTipoOuVazia ()
    {
        assertThrows (IllegalArgumentException.class, () -> Comunicado.lerJson ("{\"dados\":{}}"));
        assertThrows (IllegalArgumentException.class, () -> Comunicado.lerJson (""));
        assertThrows (IllegalArgumentException.class, () -> Comunicado.lerJson ("{\"tipo\":\"\"}"));
    }

    @Test
    void lerJsonMalFormadoLancaExcecaoDoGson ()
    {
        assertThrows (RuntimeException.class, () -> Comunicado.lerJson ("isto nao e json"));
    }

    private static class RespostaDeTeste
    {
        String texto;

        RespostaDeTeste (String texto)
        {
            this.texto = texto;
        }
    }
}
