# Supervisora.java — Uma thread por conexão

## O que deve ter neste arquivo
- Equivalente à `SupervisoraDeConexao.java` do professor: uma `Thread` por conexão aceita. Monta o `Parceiro`, adiciona-o à lista `usuarios` (dentro de `synchronized`) e entra num loop `envie()` lendo os pedidos da conexão, um de cada vez.
- A grande mudança em relação ao original: o `if/else instanceof` fixo (`PedidoDeOperacao`, `PedidoDeResultado`, `PedidoParaSair`) é substituído por uma busca no `HandlerRegistry` pelo `tipo` da mensagem. Assim nenhum grupo edita a `Supervisora`.
- Fluxo por mensagem:
  - `PedidoParaSair`: remove o usuário da lista, chama `adeus()` e encerra a thread (como no original).
  - `tipo` sem handler: responde `Erro` com `code` `UNKNOWN_TYPE`.
  - Handler que lança `ErroDeNegocio`: responde `Erro` com o `code` e a mensagem dele. Qualquer outra exceção é registrada no log e vira `INTERNAL_ERROR` genérico, sem vazar detalhe. A conexão não cai em nenhum dos dois casos.
  - Caso normal: envia a resposta do handler.
- **Cada pedido recebe exatamente uma resposta**, na mesma conexão e na ordem em que chegou. O Backend mantém conexões duradouras (um pool): cada `Supervisora` atende **vários pedidos em sequência** na mesma conexão, um de cada vez, como no original, e só recebe o `PedidoParaSair` quando o Backend encerra.
- Queda da conexão (exceção em `envie`): remove da lista e fecha, como o `catch` do original.
- **Timeout de leitura:** `conexao.setSoTimeout(TIMEOUT_LEITURA_MS)` (5 min) logo ao começar. Se o cliente fica 5 minutos sem mandar nada (o Backend mantém conexões duradouras e reconecta sozinho quando isso acontece), o `readLine` estoura, o `envie()` lança, e o `catch` do laço remove o usuário da lista e fecha a conexão, liberando a thread. O timeout só vale para *esperar o pedido*; um handler lento não é interrompido.
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
                    this.usuario.receba (Comunicado.erro(400, "UNKNOWN_TYPE",
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
                    resposta = Comunicado.erro (500, "INTERNAL_ERROR", "Erro interno do servidor");
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
```
