package com.financeai.core;

import java.io.*;
import java.net.*;
import java.util.concurrent.Semaphore;

public class Parceiro
{
    private Socket         conexao;
    private BufferedReader receptor;
    private PrintWriter    transmissor;

    private Comunicado proximoComunicado = null;

    private Semaphore mutEx = new Semaphore (1, true);

    public Parceiro (Socket conexao, BufferedReader receptor, PrintWriter transmissor)
    throws Exception // se parametro nulos
    {
        if (conexao == null)
            throw new Exception ("Conexao ausente");

        if (receptor == null)
            throw new Exception ("Receptor ausente");

        if (transmissor == null)
            throw new Exception ("Transmissor ausente");

        this.conexao     = conexao;
        this.receptor    = receptor;
        this.transmissor = transmissor;
    }

    // escreve para o outro lado; synchronized porque o Main pode mandar o
    // aviso de desligamento enquanto a Supervisora responde na mesma conexao
    public synchronized void receba (Comunicado x) throws Exception
    {
        this.transmissor.print (x.paraJson() + "\n");
        this.transmissor.flush ();

        if (this.transmissor.checkError())
            throw new Exception ("Erro de transmissao");
    }

    // olha o proximo comunicado sem consumi-lo
    public Comunicado espie () throws Exception
    {
        try
        {
            this.mutEx.acquireUninterruptibly();
            if (this.proximoComunicado == null)
                this.proximoComunicado = this.lerProximo();
            return this.proximoComunicado;
        }
        catch (Exception erro)
        {
            throw new Exception ("Erro de recepcao");
        }
        finally
        {
            this.mutEx.release();
        }
    }

    // le e consome o proximo comunicado
    public Comunicado envie () throws Exception
    {
        try
        {
            this.mutEx.acquireUninterruptibly();
            if (this.proximoComunicado == null)
                this.proximoComunicado = this.lerProximo();
            Comunicado ret         = this.proximoComunicado;
            this.proximoComunicado = null;
            return ret;
        }
        catch (Exception erro)
        {
            throw new Exception ("Erro de recepcao");
        }
        finally
        {
            this.mutEx.release();
        }
    }

    private Comunicado lerProximo () throws Exception
    {
        String linha = this.receptor.readLine(); // bloqueia ate chegar uma linha
        if (linha == null)
            throw new Exception ("Conexao encerrada");

        return Comunicado.lerJson (linha);
    }

    public void adeus () throws Exception
    {
        try
        {
            this.transmissor.close();
            this.receptor   .close();
            this.conexao    .close();
        }
        catch (Exception erro)
        {
            throw new Exception ("Erro de desconexao");
        }
    }
}
