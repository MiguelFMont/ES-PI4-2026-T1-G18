# AuthHandler.java — Handlers do Grupo 1 (Autenticação & Conta)

## O que deve ter neste arquivo
- Registra no `HandlerRegistry` os quatro pedidos do grupo: `PedidoHashSenha`, `PedidoValidarSenha`, `PedidoGerarSegredoMFA` e `PedidoValidarMFA`. O método `registrarEm(registry)` é a única coisa que `HandlerRegistry.criarPadrao()` chama.
- Concentra a parte **criptográfica** da autenticação, que fica no Java e não no Backend: hash e conferência de senha (PBKDF2 do próprio JDK, sem biblioteca extra), geração do segredo TOTP e verificação do código do MFA.
- Não acessa o MongoDB: o Backend envia no pedido tudo que o handler precisa (o hash guardado, o segredo do MFA). Quem busca o usuário, guarda o hash e emite o JWT é o Backend.
- Cada handler: lê o payload com `pedido.dadosComo(...)`, calcula e devolve `Comunicado.de(RespostaXxx.TIPO, new RespostaXxx(...))`.
- A senha em texto puro só existe dentro da conexão Backend↔Servidor e nunca deve ser logada.

## Exemplo de implementação

```java
package com.financeai.auth;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import com.financeai.core.Comunicado;
import com.financeai.core.HandlerRegistry;

public class AuthHandler
{
    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoHashSenha.TIPO,    this::hashSenha);
        registry.registrar (PedidoValidarSenha.TIPO, this::validarSenha);
        registry.registrar (PedidoGerarSegredoMFA.TIPO, this::gerarSegredoMfa);
        registry.registrar (PedidoValidarMFA.TIPO,   this::validarMfa);
    }

    private Comunicado hashSenha (Comunicado pedido) throws Exception
    {
        PedidoHashSenha p = pedido.dadosComo (PedidoHashSenha.class);

        byte[] sal = new byte[16];
        new SecureRandom().nextBytes (sal);
        String hash = b64(sal) + ":" + b64(pbkdf2(p.getSenha(), sal));

        return Comunicado.de (RespostaHashSenha.TIPO, new RespostaHashSenha(hash));
    }

    private Comunicado validarSenha (Comunicado pedido) throws Exception
    {
        PedidoValidarSenha p = pedido.dadosComo (PedidoValidarSenha.class);

        String[] partes = p.getHash().split (":");
        byte[] sal      = Base64.getDecoder().decode (partes[0]);
        byte[] esperado = Base64.getDecoder().decode (partes[1]);
        boolean valido  = MessageDigest.isEqual (esperado, pbkdf2(p.getSenha(), sal));

        return Comunicado.de (RespostaValidarSenha.TIPO, new RespostaValidarSenha(valido));
    }

    private Comunicado gerarSegredoMfa (Comunicado pedido) throws Exception
    {
        PedidoGerarSegredoMFA p = pedido.dadosComo (PedidoGerarSegredoMFA.class);

        byte[] bytes = new byte[20];
        new SecureRandom().nextBytes (bytes);
        String segredo = codificarBase32 (bytes);
        String uri = "otpauth://totp/FinanceAI:" + p.getEmail()
                   + "?secret=" + segredo + "&issuer=FinanceAI";

        return Comunicado.de (RespostaGerarSegredoMFA.TIPO, new RespostaGerarSegredoMFA(segredo, uri));
    }

    private Comunicado validarMfa (Comunicado pedido) throws Exception
    {
        PedidoValidarMFA p = pedido.dadosComo (PedidoValidarMFA.class);

        byte[] chave = decodificarBase32 (p.getSegredo());
        long   passo = System.currentTimeMillis() / 1000 / 30;

        boolean valido = false;
        for (long i = passo - 1; i <= passo + 1; i++)   // tolera 30s de diferenca de relogio
            if (gerarCodigo(chave, i).equals(p.getCodigo()))
                valido = true;

        return Comunicado.de (RespostaValidarMFA.TIPO, new RespostaValidarMFA(valido));
    }

    private static byte[] pbkdf2 (String senha, byte[] sal) throws Exception
    {
        PBEKeySpec spec = new PBEKeySpec (senha.toCharArray(), sal, 120000, 256);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    }

    private static String b64 (byte[] bytes)
    {
        return Base64.getEncoder().encodeToString (bytes);
    }

    private static String gerarCodigo (byte[] chave, long contador) throws Exception
    {
        Mac mac = Mac.getInstance ("HmacSHA1");
        mac.init (new SecretKeySpec(chave, "HmacSHA1"));
        byte[] h = mac.doFinal (ByteBuffer.allocate(8).putLong(contador).array());

        int o   = h[h.length - 1] & 0x0f;
        int bin = ((h[o] & 0x7f) << 24) | ((h[o+1] & 0xff) << 16)
                | ((h[o+2] & 0xff) << 8) |  (h[o+3] & 0xff);
        return String.format ("%06d", bin % 1000000);
    }

    private static String codificarBase32 (byte[] dados)
    {
        String alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        StringBuilder saida = new StringBuilder();
        int buffer = 0, bits = 0;

        for (byte b : dados)
        {
            buffer = (buffer << 8) | (b & 0xff);
            bits  += 8;
            while (bits >= 5)
            {
                saida.append (alfabeto.charAt ((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
            buffer &= (1 << bits) - 1;
        }
        if (bits > 0)
            saida.append (alfabeto.charAt ((buffer << (5 - bits)) & 31));

        return saida.toString();
    }

    private static byte[] decodificarBase32 (String texto)
    {
        String alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        int buffer = 0, bits = 0;

        for (char c : texto.toUpperCase().toCharArray())
        {
            int idx = alfabeto.indexOf (c);
            if (idx < 0) continue;                 // ignora '=' e separadores
            buffer = (buffer << 5) | idx;
            bits  += 5;
            if (bits >= 8)
            {
                saida.write ((buffer >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return saida.toByteArray();
    }
}
```
