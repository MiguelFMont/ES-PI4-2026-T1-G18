
package com.financeai.auth;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class AuthHandler
{
    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoHashSenha.TIPO, this::hashSenha);
        registry.registrar (PedidoValidarSenha.TIPO, this::validarSenha);
    }

    private Comunicado hashSenha (Comunicado pedido) throws Exception
    {
        PedidoHashSenha p = pedido.dadosComo (PedidoHashSenha.class);

        byte[] sal = new byte[16];
        new SecureRandom().nextBytes (sal);

        String hash = b64(sal) + ":" + b64(pbkdf2(p.getSenha(), sal));

        return Comunicado.de (
            RespostaHashSenha.TIPO,
            new RespostaHashSenha(hash)
        );
    }

    private Comunicado validarSenha (Comunicado pedido) throws Exception
    {
        PedidoValidarSenha p = pedido.dadosComo (PedidoValidarSenha.class);

        String[] partes = p.getHash().split (":");

        byte[] sal = Base64.getDecoder().decode (partes[0]);
        byte[] esperado = Base64.getDecoder().decode (partes[1]);

        boolean valido = MessageDigest.isEqual (
            esperado,
            pbkdf2(p.getSenha(), sal)
        );

        return Comunicado.de (
            RespostaValidarSenha.TIPO,
            new RespostaValidarSenha(valido)
        );
    }

    private static byte[] pbkdf2 (String senha, byte[] sal) throws Exception
    {
        PBEKeySpec spec = new PBEKeySpec (
            senha.toCharArray(),
            sal,
            120000,
            256
        );

        return SecretKeyFactory
            .getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(spec)
            .getEncoded();
    }

    private static String b64 (byte[] bytes)
    {
        return Base64.getEncoder().encodeToString(bytes);
    }
}
