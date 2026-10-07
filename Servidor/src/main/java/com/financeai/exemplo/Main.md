# Main.java — Ponto de entrada do Servidor

## O que deve ter neste arquivo
- Equivalente ao `Servidor.java` do professor (o `main` do servidor). Faz o mesmo, nesta ordem: valida os argumentos (`java Main [PORTA]`, porta padrão `3000`), cria a lista compartilhada `ArrayList<Parceiro> usuarios`, **conecta no MongoDB** (`Banco.iniciar()`; sem `MONGO_URI` sobe sem banco e avisa; com `MONGO_URI` que não conecta, mostra a mensagem e encerra), monta o `HandlerRegistry` com os handlers de todos os grupos, cria e inicia a `Aceitadora`.
- Depois fica em loop lendo comandos do console (`Teclado`). O único comando válido é `desativar`: percorre `usuarios` dentro de `synchronized`, envia o `ComunicadoDeDesligamento` para cada conexão, chama `adeus()` e termina o processo. Qualquer outro comando mostra "Comando invalido!".
- O `ComunicadoDeDesligamento` só alcança as conexões abertas naquele instante (chamadas do Backend em andamento); o Backend o trata como erro `503` ("Servidor desligando"). Novas chamadas passam a falhar com `503` até o servidor voltar.
- Porta ocupada ou inválida: mostra a mensagem e encerra, como o original.
- Pode ser iniciado antes ou depois do Backend: o Backend só abre conexão quando uma rota precisa do Servidor. Se ele estiver fora do ar, essas rotas respondem `503`.

## Exemplo de implementação

```java
package com.financeai;

import java.util.ArrayList;

import com.financeai.core.*;

public class Main
{
    public static String PORTA_PADRAO = "3000";

    public static void main (String[] args)
    {
        if (args.length > 1)
        {
            System.err.println ("Uso esperado: java Main [PORTA]\n");
            return;
        }

        String porta = Main.PORTA_PADRAO;
        if (args.length == 1)
            porta = args[0];

        ArrayList<Parceiro> usuarios = new ArrayList<Parceiro>();
        try
        {
            Banco.iniciar();   // antes do registry: os repositorios criam indices ao serem instanciados
        }
        catch (Exception erro)
        {
            System.err.println ("Nao foi possivel conectar ao MongoDB: " + erro.getMessage() + "\n");
            return;
        }

        HandlerRegistry registry = HandlerRegistry.criarPadrao();

        Aceitadora aceitadora = null;
        try
        {
            aceitadora = new Aceitadora (porta, usuarios, registry);
            aceitadora.start();
        }
        catch (Exception erro)
        {
            System.err.println ("Escolha uma porta apropriada e liberada para uso!\n");
            return;
        }

        for (;;)
        {
            System.out.println ("O servidor esta ativo! Para desativa-lo,");
            System.out.println ("use o comando \"desativar\"\n");
            System.out.print   ("> ");

            String comando = null;
            try
            {
                comando = Teclado.getUmString();
            }
            catch (Exception erro)
            {}

            if (comando.toLowerCase().equals("desativar"))
            {
                synchronized (usuarios)
                {
                    Comunicado desligamento = Comunicado.desligamento();

                    for (Parceiro usuario : usuarios)
                    {
                        try
                        {
                            usuario.receba (desligamento);
                            usuario.adeus  ();
                        }
                        catch (Exception erro)
                        {}
                    }
                }

                System.out.println ("O servidor foi desativado!\n");
                System.exit(0);
            }
            else
                System.err.println ("Comando invalido!\n");
        }
    }
}
```
