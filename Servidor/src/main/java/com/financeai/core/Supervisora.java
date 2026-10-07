package com.financeai.core;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class Supervisora extends Thread
{
    // Quanto tempo esperar por uma linha do cliente. O Backend manda o pedido logo
    // depois de conectar, entao uma conexao calada por mais que isso esta presa.
    public static final int TIMEOUT_LEITURA_MS = 30000;

    private Parceiro            usuario;
    private Socket              conexao;
    private ArrayList<Parceiro> usuarios;
    private HandlerRegistry     registry;

    public Supervisora (Socket conexao, ArrayList<Parceiro> usuarios, HandlerRegistry registry)
    throws Exception
    {
        if (conexao == null)
            throw new Exception ("Conexao ausente");

        if (usuarios == null)
            throw new Exception ("Usuarios ausentes");

        if (registry == null)
            throw new Exception ("Registry ausente");

        this.conexao  = conexao;
        this.usuarios = usuarios;
        this.registry = registry;
    }

    public void run ()
    {
        try
        {
            this.conexao.setSoTimeout (TIMEOUT_LEITURA_MS);

            BufferedReader receptor =
            new BufferedReader (
            new InputStreamReader (
            this.conexao.getInputStream(), StandardCharsets.UTF_8));

            PrintWriter transmissor =
            new PrintWriter (
            new OutputStreamWriter (
            this.conexao.getOutputStream(), StandardCharsets.UTF_8));

            this.usuario = new Parceiro (this.conexao, receptor, transmissor);
        }
        catch (Exception erro)
        {
            return;
        }

        try
        {
            synchronized (this.usuarios)
            {
                this.usuarios.add (this.usuario);
            }

            for (;;)
            {
                Comunicado pedido = this.usuario.envie ();

                if (pedido.getTipo().equals(Comunicado.TIPO_PEDIDO_PARA_SAIR))
                {
                    synchronized (this.usuarios)
                    {
                        this.usuarios.remove (this.usuario);
                    }
                    this.usuario.adeus();
                    return;
                }

                Handler handler = this.registry.obter (pedido.getTipo());
                if (handler == null)
                {
                    this.usuario.receba (Comunicado.erro("UNKNOWN_TYPE",
                                         "Tipo de pedido desconhecido: " + pedido.getTipo()));
                    continue;
                }

                Comunicado resposta;
                try
                {
                    resposta = handler.tratar (pedido);
                }
                catch (ErroDeNegocio erro)
                {
                    resposta = Comunicado.erro (erro.getCode(), erro.getMessage());
                }
                catch (Exception erro)
                {
                    erro.printStackTrace();   // detalhe fica so no log do servidor
                    resposta = Comunicado.erro ("INTERNAL_ERROR", "Erro interno do servidor");
                }

                this.usuario.receba (resposta);
            }
        }
        catch (Exception erro)
        {
            synchronized (this.usuarios)
            {
                this.usuarios.remove (this.usuario);
            }

            try
            {
                this.usuario.adeus();
            }
            catch (Exception falha)
            {} // so tentando fechar antes de acabar a thread
        }
    }
}
