# Parceiro.java — Conexão com o outro lado (envie / receba / espie)

## O que deve ter neste arquivo
- Port do `Parceiro.java` do professor, com a mesma estrutura e os **mesmos métodos e significados**: `receba(x)` escreve para o outro lado, `envie()` lê e consome a próxima mensagem, `espie()` lê sem consumir, `adeus()` fecha tudo. Mantém o `Semaphore mutEx` e o campo `proximoComunicado`.
- A diferença é só o transporte: em vez de `ObjectInputStream`/`ObjectOutputStream`, usa `BufferedReader`/`PrintWriter` em UTF-8, uma mensagem JSON por linha (`\n`). Isso evita a ordem delicada de criação dos streams do original.
- `receba` é `synchronized`: o `Main` pode mandar o `ComunicadoDeDesligamento` ao mesmo tempo em que uma `Supervisora` está respondendo na mesma conexão, e as linhas não podem se misturar.
- Erros viram `Exception` com a mesma mensagem do original ("Erro de transmissao", "Erro de recepcao", "Erro de desconexao").
- Não decide o que fazer com as mensagens; só fala o protocolo.

## Exemplo de implementação

```java
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
    throws Exception
    {
        if (conexao == null)     throw new Exception ("Conexao ausente");
        if (receptor == null)    throw new Exception ("Receptor ausente");
        if (transmissor == null) throw new Exception ("Transmissor ausente");

        this.conexao     = conexao;
        this.receptor    = receptor;
        this.transmissor = transmissor;
    }

    public synchronized void receba (Comunicado x) throws Exception
    {
        this.transmissor.print (x.paraJson() + "\n");
        this.transmissor.flush ();

        if (this.transmissor.checkError())
            throw new Exception ("Erro de transmissao");
    }

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

    public Comunicado envie () throws Exception
    {
        try
        {
            this.mutEx.acquireUninterruptibly();
            if (this.proximoComunicado == null)
                this.proximoComunicado = this.lerProximo();
            Comunicado ret = this.proximoComunicado;
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
        String linha = this.receptor.readLine();   // bloqueia ate chegar uma linha
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
```
