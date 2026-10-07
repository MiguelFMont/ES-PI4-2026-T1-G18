# AuthHandler.java — Handlers do Grupo 1 (Autenticação & Conta)

## O que deve ter neste arquivo
- Registra no `HandlerRegistry` os cinco pedidos do grupo: `PedidoRegistrarUsuario`, `PedidoLogin`, `PedidoObterPerfil`, `PedidoHabilitarMFA` e `PedidoValidarMFA`. O método `registrarEm(registry)` é a única coisa que `HandlerRegistry.criarPadrao()` chama.
- É o **dono dos usuários**: valida os dados, confere e-mail duplicado, faz o hash da senha e grava no MongoDB (via `AuthRepository`). O Backend só repassa a requisição e assina o JWT depois de um login bem-sucedido.
- Concentra a parte criptográfica: hash e conferência de senha (PBKDF2 do próprio JDK, sem biblioteca extra) e geração e verificação do segredo TOTP do MFA. O hash e o segredo **nunca saem do Servidor**: `Banco.paraMapa` e as respostas só levam dados públicos.
- Falhas de regra viram `ErroDeNegocio`: `409 EMAIL_IN_USE`, `401 INVALID_CREDENTIALS` (a mesma resposta para e-mail inexistente e senha errada, para não revelar quais e-mails existem), `404 USER_NOT_FOUND`, `400 MFA_NOT_ENABLED`, `400 VALIDATION`.
- A senha em texto puro só existe dentro da conexão Backend↔Servidor e nunca deve ser logada.

## Exemplo de implementação

```java
package com.financeai.auth;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Date;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import org.bson.Document;

import com.financeai.core.Comunicado;
import com.financeai.core.ErroDeNegocio;
import com.financeai.core.HandlerRegistry;
import com.mongodb.ErrorCategory;
import com.mongodb.MongoWriteException;

public class AuthHandler
{
    private static final String ALFABETO_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private final AuthRepository repositorio = new AuthRepository();

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (PedidoRegistrarUsuario.TIPO, this::registrar);
        registry.registrar (PedidoLogin.TIPO,            this::login);
        registry.registrar (PedidoObterPerfil.TIPO,      this::obterPerfil);
        registry.registrar (PedidoHabilitarMFA.TIPO,     this::habilitarMfa);
        registry.registrar (PedidoValidarMFA.TIPO,       this::validarMfa);
    }

    private Comunicado registrar (Comunicado pedido) throws Exception
    {
        PedidoRegistrarUsuario p = pedido.dadosComo (PedidoRegistrarUsuario.class);

        if (vazio(p.getNome()) || vazio(p.getEmail()) || vazio(p.getCpf())
            || p.getSenha() == null || p.getSenha().length() < 8)
            throw new ErroDeNegocio ("VALIDATION", "Dados de cadastro invalidos");

        if (this.repositorio.buscarPorEmail(p.getEmail()) != null)
            throw new ErroDeNegocio ("EMAIL_IN_USE", "E-mail ja cadastrado");

        Document usuario = new Document ("nome", p.getNome())
            .append ("email",      p.getEmail())
            .append ("cpf",        p.getCpf())
            .append ("senhaHash",  hashSenha(p.getSenha()))
            .append ("mfaEnabled", false)
            .append ("plano",      "free")
            .append ("createdAt",  new Date());

        try
        {
            this.repositorio.criar (usuario);
        }
        catch (MongoWriteException erro)   // duas requisicoes simultaneas com o mesmo e-mail
        {
            if (erro.getError().getCategory() == ErrorCategory.DUPLICATE_KEY)
                throw new ErroDeNegocio ("EMAIL_IN_USE", "E-mail ja cadastrado");
            throw erro;
        }

        return Comunicado.de (RespostaRegistrarUsuario.TIPO,
            new RespostaRegistrarUsuario (usuario.getObjectId("_id").toHexString(), p.getNome(), p.getEmail()));
    }

    private Comunicado login (Comunicado pedido) throws Exception
    {
        PedidoLogin p = pedido.dadosComo (PedidoLogin.class);

        Document usuario = this.repositorio.buscarPorEmail (p.getEmail());
        if (usuario == null || p.getSenha() == null || !conferirSenha(p.getSenha(), usuario.getString("senhaHash")))
            throw new ErroDeNegocio ("INVALID_CREDENTIALS", "E-mail ou senha incorretos");

        return Comunicado.de (RespostaLogin.TIPO, new RespostaLogin (
            usuario.getObjectId("_id").toHexString(), usuario.getString("nome"), usuario.getString("email"),
            usuario.getString("plano"), usuario.getBoolean("mfaEnabled", false)));
    }

    private Comunicado obterPerfil (Comunicado pedido) throws Exception
    {
        PedidoObterPerfil p = pedido.dadosComo (PedidoObterPerfil.class);

        Document usuario = this.repositorio.buscarPorId (p.getUserId());
        if (usuario == null)
            throw new ErroDeNegocio ("USER_NOT_FOUND", "Usuario nao encontrado");

        return Comunicado.de (RespostaObterPerfil.TIPO, new RespostaObterPerfil (
            usuario.getObjectId("_id").toHexString(), usuario.getString("nome"), usuario.getString("email"),
            usuario.getString("plano"), usuario.getBoolean("mfaEnabled", false)));
    }

    private Comunicado habilitarMfa (Comunicado pedido) throws Exception
    {
        PedidoHabilitarMFA p = pedido.dadosComo (PedidoHabilitarMFA.class);

        if (this.repositorio.buscarPorId(p.getUserId()) == null)
            throw new ErroDeNegocio ("USER_NOT_FOUND", "Usuario nao encontrado");

        byte[] aleatorio = new byte[20];
        new SecureRandom().nextBytes (aleatorio);
        String segredo = codificarBase32 (aleatorio);

        this.repositorio.salvarSegredoMfa (p.getUserId(), segredo);

        return Comunicado.de (RespostaHabilitarMFA.TIPO, new RespostaHabilitarMFA (true, segredo));
    }

    private Comunicado validarMfa (Comunicado pedido) throws Exception
    {
        PedidoValidarMFA p = pedido.dadosComo (PedidoValidarMFA.class);

        Document usuario = this.repositorio.buscarPorId (p.getUserId());
        if (usuario == null)
            throw new ErroDeNegocio ("USER_NOT_FOUND", "Usuario nao encontrado");

        String segredo = usuario.getString ("mfaSecret");
        if (segredo == null)
            throw new ErroDeNegocio ("MFA_NOT_ENABLED", "MFA nao habilitado");

        byte[] chave = decodificarBase32 (segredo);
        long   passo = System.currentTimeMillis() / 1000 / 30;

        boolean valido = false;
        for (long i = passo - 1; i <= passo + 1; i++)   // tolera 30s de diferenca de relogio
            if (gerarCodigo(chave, i).equals(p.getCodigo()))
                valido = true;

        return Comunicado.de (RespostaValidarMFA.TIPO, new RespostaValidarMFA (valido));
    }

    private static boolean vazio (String texto)
    {
        return texto == null || texto.isBlank();
    }

    private static String hashSenha (String senha) throws Exception
    {
        byte[] sal = new byte[16];
        new SecureRandom().nextBytes (sal);
        return b64(sal) + ":" + b64(pbkdf2(senha, sal));
    }

    private static boolean conferirSenha (String senha, String hashGuardado) throws Exception
    {
        String[] partes = hashGuardado.split (":");
        byte[] sal      = Base64.getDecoder().decode (partes[0]);
        byte[] esperado = Base64.getDecoder().decode (partes[1]);
        return MessageDigest.isEqual (esperado, pbkdf2(senha, sal));
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

    private static String codificarBase32 (byte[] bytes)
    {
        StringBuilder saida = new StringBuilder();
        int buffer = 0, bits = 0;

        for (byte b : bytes)
        {
            buffer = (buffer << 8) | (b & 0xff);
            bits  += 8;
            while (bits >= 5)
            {
                saida.append (ALFABETO_BASE32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0)
            saida.append (ALFABETO_BASE32.charAt((buffer << (5 - bits)) & 31));

        return saida.toString();
    }

    private static byte[] decodificarBase32 (String texto)
    {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        int buffer = 0, bits = 0;

        for (char c : texto.toUpperCase().toCharArray())
        {
            int idx = ALFABETO_BASE32.indexOf (c);
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
