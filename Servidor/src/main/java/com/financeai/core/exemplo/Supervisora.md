# Supervisora.java — Uma thread por conexão

## O que deve ter neste arquivo
- Equivalente à `SupervisoraDeConexao.java` do professor: uma `Thread` por conexão aceita. Monta o `Parceiro`, adiciona-o à lista `usuarios` (dentro de `synchronized`) e entra num loop `envie()` lendo os pedidos da conexão, um de cada vez.
- A grande mudança em relação ao original: o `if/else instanceof` fixo (`PedidoDeOperacao`, `PedidoDeResultado`, `PedidoParaSair`) é substituído por uma busca no `HandlerRegistry` pelo `tipo` da mensagem. Assim nenhum grupo edita a `Supervisora`.
- Fluxo por mensagem:
  - `PedidoParaSair`: remove o usuário da lista, chama `adeus()` e encerra a thread (como no original).
  - `tipo` sem handler: responde `Erro` ("Tipo de pedido desconhecido").
  - Handler que lança exceção: responde `Erro` com a mensagem, sem derrubar a conexão.
  - Caso normal: envia a resposta do handler.
- **Cada pedido recebe exatamente uma resposta, na mesma ordem em que chegou.** O Backend casa as respostas por ordem de chegada (não há ID), então este laço sequencial é parte do contrato.
- Queda da conexão (exceção em `envie`): remove da lista e fecha, como o `catch` do original.
- Estado por conexão (como o `double valor` do original) é opcional; nos handlers do FinanceAI o estado fica no MongoDB, então a `Supervisora` não guarda nada.

## Exemplo de implementação

```java
package com.financeai.core;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class Supervisora extends Thread
{
    private Parceiro            usuario;
    private Socket              conexao;
    private ArrayList<Parceiro> usuarios;
    private HandlerRegistry     registry;

    public Supervisora (Socket conexao, ArrayList<Parceiro> usuarios, HandlerRegistry registry)
    throws Exception
    {
        if (conexao == null)  throw new Exception ("Conexao ausente");
        if (usuarios == null) throw new Exception ("Usuarios ausentes");
        if (registry == null) throw new Exception ("Registry ausente");

        this.conexao  = conexao;
        this.usuarios = usuarios;
        this.registry = registry;
    }

    public void run ()
    {
        try
        {
            BufferedReader receptor = new BufferedReader (
                new InputStreamReader (this.conexao.getInputStream(), StandardCharsets.UTF_8));
            PrintWriter transmissor = new PrintWriter (
                new OutputStreamWriter (this.conexao.getOutputStream(), StandardCharsets.UTF_8));

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
                Comunicado pedido = this.usuario.envie();

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
                    this.usuario.receba (Comunicado.erro("Tipo de pedido desconhecido: " + pedido.getTipo()));
                    continue;
                }

                try
                {
                    this.usuario.receba (handler.tratar(pedido));
                }
                catch (Exception erro)
                {
                    this.usuario.receba (Comunicado.erro(erro.getMessage()));
                }
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
```
