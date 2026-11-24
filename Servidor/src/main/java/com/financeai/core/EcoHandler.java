package com.financeai.core;

import com.google.gson.JsonObject;

// Handler de teste: devolve em RespostaEco o mesmo "dados" recebido em PedidoEco.
// Serve para verificar que a conexao, o protocolo JSON e o HandlerRegistry funcionam.
// Para testar o contrato de erro, "dados" pode trazer {"falhar":"negocio"} (responde
// Erro TESTE_NEGOCIO) ou {"falhar":"interno"} (responde Erro INTERNAL_ERROR).
public class EcoHandler
{
    public static final String TIPO_PEDIDO   = "PedidoEco";
    public static final String TIPO_RESPOSTA = "RespostaEco";

    public void registrarEm (HandlerRegistry registry)
    {
        registry.registrar (TIPO_PEDIDO, this::eco);
    }

    private Comunicado eco (Comunicado pedido) throws Exception
    {
        if (pedido.getDados().isJsonObject())
        {
            JsonObject dados = pedido.getDados().getAsJsonObject();

            if (dados.has("falhar"))
            {
                String tipo = dados.get("falhar").getAsString();

                if (tipo.equals("negocio"))
                    throw new ErroDeNegocio ("TESTE_NEGOCIO", "Falha de negocio de teste");
                if (tipo.equals("interno"))
                    throw new RuntimeException ("Falha interna de teste");
            }
        }

        return new Comunicado (TIPO_RESPOSTA, pedido.getDados());
    }
}
