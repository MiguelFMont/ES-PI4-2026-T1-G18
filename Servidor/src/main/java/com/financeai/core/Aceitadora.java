package com.financeai.core;

import java.net.*;
import java.util.*;

public class Aceitadora extends Thread
{
    private ServerSocket        pedido;
    private ArrayList<Parceiro> usuarios;
    private HandlerRegistry     registry;

    public Aceitadora (String porta, ArrayList<Parceiro> usuarios, HandlerRegistry registry)
    throws Exception
    {
        if (porta == null)
            throw new Exception ("Porta ausente");

        try
        {
            // so aceita conexoes da propria maquina: o Servidor confia no userId
            // enviado pelo Backend, entao nao pode ficar exposto na rede
            this.pedido = new ServerSocket (Integer.parseInt(porta), 50, InetAddress.getLoopbackAddress());
        }
        catch (Exception erro)
        {
            throw new Exception ("Porta invalida");
        }

        if (usuarios == null)
            throw new Exception ("Usuarios ausentes");

        if (registry == null)
            throw new Exception ("Registry ausente");

        this.usuarios = usuarios;
        this.registry = registry;
    }

    public void run ()
    {
        for (;;)
        {
            Socket conexao = null;
            try
            {
                conexao = this.pedido.accept();
            }
            catch (Exception erro)
            {
                continue;
            }

            Supervisora supervisora = null;
            try
            {
                supervisora = new Supervisora (conexao, this.usuarios, this.registry);
            }
            catch (Exception erro)
            {} // sei que passei parametros corretos para o construtor
            supervisora.start();
        }
    }
}
