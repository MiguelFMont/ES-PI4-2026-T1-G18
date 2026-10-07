# Aceitadora.java — Thread que aceita conexões

## O que deve ter neste arquivo
- **Escuta só em `127.0.0.1`** (`InetAddress.getLoopbackAddress()`): o Servidor confia no `userId` que o Backend manda, então não pode aceitar conexões vindas da rede.
- Equivalente à `AceitadoraDeConexao.java` do professor: uma `Thread` com um `ServerSocket` que fica em loop chamando `accept()`. Para cada conexão aceita, cria e inicia uma `Supervisora`.
- Recebe a porta, a lista compartilhada de usuários (`ArrayList<Parceiro>`) e o `HandlerRegistry`, que repassa para cada `Supervisora` criada.
- Valida os parâmetros no construtor (porta ausente ou inválida, lista ausente), como no original.
- Na prática, cada conexão aceita é uma chamada do Backend (uma conexão por pedido, que termina com `PedidoParaSair`), então a `Aceitadora` cria e descarta `Supervisora`s o tempo todo.

## Exemplo de implementação

```java
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
```
