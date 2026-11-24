package com.financeai.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;

// Teste do Grupo 1 (Autenticacao): hash e conferencia de senha (PBKDF2), pelo HandlerRegistry, como chega da Supervisora.
// INTRACLASSE de AuthHandler. Particionamento por categorias de metodos (gerar hash, conferir senha) e por atributos
// (senha correta, senha errada, senha ausente, hash mal formado).
// INTERCLASSE: hash e conferencia em sequencia (o hash gerado por um pedido e conferido pelo outro).
class AuthHandlerTest
{
    private HandlerRegistry registry;

    @BeforeEach
    void registrar ()
    {
        this.registry = new HandlerRegistry();
        new AuthHandler().registrarEm (this.registry);
    }

    private Comunicado pedir (String tipo, String dados) throws Exception
    {
        return this.registry.obter (tipo).tratar (Comunicado.lerJson ("{\"tipo\":\"" + tipo + "\",\"dados\":" + dados + "}"));
    }

    private String hashDe (String senha) throws Exception
    {
        Comunicado resposta = pedir (PedidoHashSenha.TIPO, "{\"senha\":\"" + senha + "\"}");
        assertEquals (RespostaHashSenha.TIPO, resposta.getTipo());
        return resposta.dadosComo (RespostaHashSenha.class).getHash();
    }

    private boolean confere (String senha, String hash) throws Exception
    {
        Comunicado resposta = pedir (PedidoValidarSenha.TIPO, "{\"senha\":\"" + senha + "\",\"hash\":\"" + hash + "\"}");
        assertEquals (RespostaValidarSenha.TIPO, resposta.getTipo());
        return resposta.dadosComo (RespostaValidarSenha.class).getValido();
    }

    @Test
    void hashTemOFormatoSalDoisPontosHashEDifereDaSenha () throws Exception
    {
        String hash = hashDe ("Abcdef1!");

        assertEquals (2, hash.split (":").length);
        assertFalse (hash.contains ("Abcdef1!"));
    }

    @Test
    void mesmaSenhaGeraHashesDiferentesPorCausaDoSal () throws Exception
    {
        assertNotEquals (hashDe ("Abcdef1!"), hashDe ("Abcdef1!"));
    }

    @Test
    void senhaCorretaConfereComOHashGeradoPorOutroPedido () throws Exception
    {
        String hash = hashDe ("Abcdef1!");

        assertTrue (confere ("Abcdef1!", hash));
    }

    @Test
    void senhaErradaOuDiferenteSoNaCaixaNaoConfere () throws Exception
    {
        String hash = hashDe ("Abcdef1!");

        assertFalse (confere ("abcdef1!", hash));
        assertFalse (confere ("Abcdef1", hash));
    }

    @Test
    void senhaAusenteNosDoisPedidosEhErroDeValidacao ()
    {
        ErroDeNegocio erroHash = assertThrows (ErroDeNegocio.class, () -> pedir (PedidoHashSenha.TIPO, "{}"));
        assertEquals ("VALIDATION", erroHash.getCode());

        ErroDeNegocio erroValidar = assertThrows (ErroDeNegocio.class, () -> pedir (PedidoValidarSenha.TIPO, "{\"hash\":\"a:b\"}"));
        assertEquals ("VALIDATION", erroValidar.getCode());
    }

    @Test
    void hashMalFormadoEhErroDeValidacao ()
    {
        ErroDeNegocio erro = assertThrows (ErroDeNegocio.class, () -> pedir (PedidoValidarSenha.TIPO, "{\"senha\":\"x\",\"hash\":\"semdoispontos\"}"));
        assertEquals ("VALIDATION", erro.getCode());
    }
}
