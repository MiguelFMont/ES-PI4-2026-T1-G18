# Main.java — Ponto de entrada do Servidor

## O que deve ter neste arquivo
- Equivalente ao `Servidor.java` do professor (o `main` do servidor). Faz o mesmo, nesta ordem: valida os argumentos (`java Main [PORTA]`, porta padrão `3000`), cria a lista compartilhada `ArrayList<Parceiro> usuarios`, monta o `HandlerRegistry` com os handlers de todos os grupos, cria e inicia a `Aceitadora`.
- Depois fica em loop lendo comandos do console (`Teclado`). O único comando válido é `desativar`: percorre `usuarios` dentro de `synchronized`, envia o `ComunicadoDeDesligamento` para cada conexão, chama `adeus()` e termina o processo. Qualquer outro comando mostra "Comando invalido!".
- O `ComunicadoDeDesligamento` chega a todas as conexões abertas do Backend (que mantém um pool de conexões duradouras); ele o trata como erro `503` ("Servidor desligando") e descarta essas conexões, o equivalente ao "volte mais tarde" do cliente do professor.
- Porta ocupada ou inválida: mostra a mensagem e encerra, como o original.
- Pode ser iniciado antes ou depois do Backend: o Backend só conecta quando uma rota precisa do Servidor e reconecta sozinho. Se o Servidor estiver fora do ar, essas rotas respondem `503`.
- O Servidor **não tem banco de dados**: ele só executa operações sobre os dados que chegam no pedido (como o "fazedor de continhas"). O MongoDB é do Backend.

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
