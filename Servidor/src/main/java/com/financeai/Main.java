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
            if (Banco.iniciar())
                System.out.println ("Conectado ao MongoDB.");
            else
                System.out.println ("MONGO_URI nao definida: servidor sem banco (so para testes de socket).");
        }
        catch (Exception erro)
        {
            System.err.println ("Nao foi possivel conectar ao MongoDB: " + erro.getMessage() + "\n");
            return;
        }

        // o registry vem depois do banco: os repositorios criam indices ao serem instanciados
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

            if (comando == null) // console fechado (ex.: rodando sem teclado): segue atendendo conexoes
            {
                try
                {
                    aceitadora.join();
                }
                catch (InterruptedException erro)
                {}
                return;
            }

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

                Banco.encerrar();
                System.out.println ("O servidor foi desativado!\n");
                System.exit(0);
            }
            else
                System.err.println ("Comando invalido!\n");
        }
    }
}
