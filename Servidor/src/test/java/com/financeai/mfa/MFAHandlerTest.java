/*
Autor: Julia Da Silva Maia 
 RA: 25016200
*/
package com.financeai.mfa;

import com.financeai.auth.PedidoGerarSegredoMFA;
import com.financeai.auth.PedidoValidarMFA;
import com.financeai.auth.RespostaGerarSegredoMFA;
import com.financeai.auth.RespostaValidarMFA;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class MFAHandlerTest {

    private static final String BASE32 =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private static final String SEGREDO_TESTE =
        "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

    private boolean validar(String segredo, String codigo)
            throws Exception {

        HandlerRegistry registry = HandlerRegistry.criarPadrao();

        Comunicado pedido = Comunicado.de(
            PedidoValidarMFA.TIPO,
            Map.of(
                "segredo", segredo,
                "codigo", codigo
            )
        );

        Comunicado resposta = registry
            .obter(PedidoValidarMFA.TIPO)
            .tratar(pedido);

        assertEquals(
            RespostaValidarMFA.TIPO,
            resposta.getTipo()
        );

        return resposta
            .dadosComo(RespostaValidarMFA.class)
            .getValido();
    }

    private byte[] decodificarBase32(String texto) {
        java.io.ByteArrayOutputStream saida =
            new java.io.ByteArrayOutputStream();

        int buffer = 0;
        int bits = 0;

        for (char caractere : texto.toCharArray()) {
            int valor = BASE32.indexOf(caractere);

            if (valor < 0) {
                throw new IllegalArgumentException(
                    "Segredo de teste inválido"
                );
            }

            buffer = (buffer << 5) | valor;
            bits += 5;

            if (bits >= 8) {
                bits -= 8;
                saida.write((buffer >> bits) & 0xFF);
            }
        }

        return saida.toByteArray();
    }

    private String gerarCodigoTeste(
        String segredo, long contador
    ) throws Exception {

        byte[] chave = decodificarBase32(segredo);

        Mac mac = Mac.getInstance("HmacSHA1");

        mac.init(
            new SecretKeySpec(chave, "HmacSHA1")
        );

        byte[] mensagem = ByteBuffer
            .allocate(8)
            .putLong(contador)
            .array();

        byte[] hash = mac.doFinal(mensagem);

        int offset = hash[hash.length - 1] & 0x0F;

        int numero =
            ((hash[offset] & 0x7F) << 24)
            | ((hash[offset + 1] & 0xFF) << 16)
            | ((hash[offset + 2] & 0xFF) << 8)
            | (hash[offset + 3] & 0xFF);

        return String.format(
            "%06d", numero % 1000000
        );
    }

    @Test
    void deveGerarSegredoMFA() throws Exception {
        HandlerRegistry registry = HandlerRegistry.criarPadrao();

        Comunicado pedido = Comunicado.de(
            PedidoGerarSegredoMFA.TIPO,
            Map.of("email", "teste@financeai.com")
        );

        Comunicado resposta = registry
            .obter(PedidoGerarSegredoMFA.TIPO)
            .tratar(pedido);

        assertEquals(
            RespostaGerarSegredoMFA.TIPO,
            resposta.getTipo()
        );

        RespostaGerarSegredoMFA dados =
            resposta.dadosComo(RespostaGerarSegredoMFA.class);

        assertNotNull(dados.getSegredo());
        assertEquals(32, dados.getSegredo().length());

        assertTrue(
            dados.getUri().startsWith("otpauth://totp/")
        );

        assertTrue(
            dados.getUri().contains("issuer=FinanceAI")
        );
    }

    @Test
    void deveRejeitarCodigoIncorreto() throws Exception {
        assertFalse(
            validar(SEGREDO_TESTE, "ABCDEF")
        );
    }

    @Test
    void deveAceitarCodigoCorreto() throws Exception {
        long contador =
            System.currentTimeMillis() / 1000 / 30;

        String codigo = gerarCodigoTeste(
            SEGREDO_TESTE, contador
        );

        assertTrue(
            validar(SEGREDO_TESTE, codigo)
        );
    }

    @Test
    void deveRejeitarCodigoExpirado() throws Exception {
        long contador =
            System.currentTimeMillis() / 1000 / 30;

        String codigoExpirado = gerarCodigoTeste(
            SEGREDO_TESTE, contador - 10
        );

        assertFalse(
            validar(SEGREDO_TESTE, codigoExpirado)
        );
    }
}
