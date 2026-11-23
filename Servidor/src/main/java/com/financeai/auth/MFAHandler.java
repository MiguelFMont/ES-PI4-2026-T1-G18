package com.financeai.auth;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class MFAHandler {

    private static final String BASE32 =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private static final int PERIODO = 30;

    public void registrarEm(HandlerRegistry registry) {
        registry.registrar(
            PedidoGerarSegredoMFA.TIPO,
            this::gerarSegredo
        );

        registry.registrar(
            PedidoValidarMFA.TIPO,
            this::validarMFA
        );
    }

    private Comunicado gerarSegredo(Comunicado pedido)
            throws Exception {

        PedidoGerarSegredoMFA p =
            pedido.dadosComo(PedidoGerarSegredoMFA.class);

        if (p.getEmail() == null ||
            p.getEmail().isBlank()) {
            throw new IllegalArgumentException(
                "E-mail inválido."
            );
        }

        byte[] bytes = new byte[20];
        new SecureRandom().nextBytes(bytes);

        String segredo = codificarBase32(bytes);

        String identificador = URLEncoder.encode(
            "FinanceAI:" + p.getEmail(),
            StandardCharsets.UTF_8
        ).replace("+", "%20");

        String uri = "otpauth://totp/" + identificador
            + "?secret=" + segredo
            + "&issuer=FinanceAI"
            + "&algorithm=SHA1"
            + "&digits=6"
            + "&period=30";

        return Comunicado.de(
            RespostaGerarSegredoMFA.TIPO,
            new RespostaGerarSegredoMFA(segredo, uri)
        );
    }

    private Comunicado validarMFA(Comunicado pedido)
            throws Exception {

        PedidoValidarMFA p =
            pedido.dadosComo(PedidoValidarMFA.class);

        boolean valido = false;
        Long contadorValidado = null;

        if (p.getSegredo() != null &&
            p.getCodigo() != null &&
            p.getCodigo().matches("[0-9]{6}")) {

            try {
                byte[] chave = decodificarBase32(
                    p.getSegredo()
                );

                long contador =
                    System.currentTimeMillis() / 1000 / PERIODO;

                for (long i = -1; i <= 1; i++) {
                    String esperado = gerarCodigo(
                        chave, contador + i
                    );

                    if (MessageDigest.isEqual(
                        esperado.getBytes(StandardCharsets.US_ASCII),
                        p.getCodigo().getBytes(StandardCharsets.US_ASCII)
                    )) {
                        valido = true;
                        contadorValidado = contador + i;
                        break;
                    }
                }

            } catch (IllegalArgumentException erro) {
                valido = false;
            }
        }

        return Comunicado.de(
            RespostaValidarMFA.TIPO,
            new RespostaValidarMFA(valido, contadorValidado)
        );
    }

    private static String gerarCodigo(
        byte[] chave, long contador
    ) throws Exception {

        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(chave, "HmacSHA1"));

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

        return String.format("%06d", numero % 1000000);
    }

    private static String codificarBase32(byte[] dados) {
        StringBuilder resultado = new StringBuilder();

        int buffer = 0;
        int bits = 0;

        for (byte dado : dados) {
            buffer = (buffer << 8) | (dado & 0xFF);
            bits += 8;

            while (bits >= 5) {
                bits -= 5;
                resultado.append(
                    BASE32.charAt((buffer >> bits) & 31)
                );
            }
        }

        if (bits > 0) {
            resultado.append(
                BASE32.charAt((buffer << (5 - bits)) & 31)
            );
        }

        return resultado.toString();
    }

    private static byte[] decodificarBase32(String texto) {
        String segredo = texto.toUpperCase()
            .replace("=", "");

        if (segredo.isEmpty()) {
            throw new IllegalArgumentException(
                "Segredo inválido."
            );
        }

        java.io.ByteArrayOutputStream saida =
            new java.io.ByteArrayOutputStream();

        int buffer = 0;
        int bits = 0;

        for (char caractere : segredo.toCharArray()) {
            int valor = BASE32.indexOf(caractere);

            if (valor < 0) {
                throw new IllegalArgumentException(
                    "Segredo inválido."
                );
            }

            buffer = (buffer << 5) | valor;
            bits += 5;

            if (bits >= 8) {
                bits -= 8;
                saida.write((buffer >> bits) & 0xFF);
            }
        }

        byte[] chave = saida.toByteArray();

        if (chave.length != 20) {
            throw new IllegalArgumentException(
                "Tamanho de segredo inválido."
            );
        }

        return chave;
    }
}
